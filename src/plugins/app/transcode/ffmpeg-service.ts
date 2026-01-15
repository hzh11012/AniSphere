import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import type { Result } from 'neverthrow';
import { err, toResult } from '../../../utils/result.js';

declare module 'fastify' {
  interface FastifyInstance {
    ffmpegService: ReturnType<typeof createFFmpegService>;
  }
}

interface TranscodeOptions {
  taskId: number;
  inputPath: string;
  outputDir: string;
}

interface TranscodeProgress {
  taskId: number;
  progress: number;
  frame: number;
  fps: number;
  speed: string;
  currentTime: number;
  duration: number;
}

interface TranscodeResult {
  success: boolean;
  outputPath: string;
  playlistPath: string;
  usedCopy: boolean;
  duration: number;
  error?: string;
}

interface VideoInfo {
  videoCodec: string;
  audioCodec: string;
  duration: number;
  width: number;
  height: number;
  isH264: boolean;
  isAAC: boolean;
  canCopyVideo: boolean;
  canCopyAudio: boolean;
}

const createFFmpegService = (fastify: FastifyInstance) => {
  const { config, log, tasksRepository } = fastify;
  const activeProcesses = new Map<number, ChildProcess>();
  const eventEmitter = new EventEmitter();

  /**
   * 使用 ffprobe 获取视频信息（编码 + 时长）
   */
  const getVideoInfo = async (inputPath: string): Promise<VideoInfo> => {
    return new Promise((resolve, reject) => {
      const args = [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        '-select_streams',
        'v:0,a:0',
        inputPath
      ];

      const ffprobe = spawn('ffprobe', args);
      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', data => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', data => {
        stderr += data.toString();
      });

      ffprobe.on('close', code => {
        if (code !== 0) {
          log.warn({ inputPath, stderr }, '[FFmpeg] ffprobe failed');
          resolve({
            videoCodec: 'unknown',
            audioCodec: 'unknown',
            duration: 0,
            width: 0,
            height: 0,
            isH264: false,
            isAAC: false,
            canCopyVideo: false,
            canCopyAudio: false
          });
          return;
        }

        try {
          const info = JSON.parse(stdout);
          const streams = info.streams || [];
          const format = info.format || {};
          const videoStream = streams.find(
            (s: any) => s.codec_type === 'video'
          );
          const audioStream = streams.find(
            (s: any) => s.codec_type === 'audio'
          );
          const videoCodec = videoStream?.codec_name || 'unknown';
          const audioCodec = audioStream?.codec_name || 'unknown';
          const duration =
            parseFloat(format.duration) ||
            parseFloat(videoStream?.duration) ||
            0;
          const width = videoStream?.width || 0;
          const height = videoStream?.height || 0;
          const isH264 = ['h264', 'avc1', 'avc'].includes(
            videoCodec.toLowerCase()
          );
          const isAAC = ['aac', 'mp4a'].includes(audioCodec.toLowerCase());
          const canCopyVideo = isH264;
          const canCopyAudio = isAAC;

          log.info(
            {
              inputPath,
              videoCodec,
              audioCodec,
              duration,
              width,
              height,
              canCopyVideo,
              canCopyAudio
            },
            '[FFmpeg] video info detected'
          );

          resolve({
            videoCodec,
            audioCodec,
            duration,
            width,
            height,
            isH264,
            isAAC,
            canCopyVideo,
            canCopyAudio
          });
        } catch (error) {
          log.error({ error, stdout }, 'Failed to parse ffprobe output');
          resolve({
            videoCodec: 'unknown',
            audioCodec: 'unknown',
            duration: 0,
            width: 0,
            height: 0,
            isH264: false,
            isAAC: false,
            canCopyVideo: false,
            canCopyAudio: false
          });
        }
      });

      ffprobe.on('error', reject);
    });
  };

  /**
   * 构建 FFmpeg 参数
   * - H.264：直接复制
   * - 非 H.264：重编码为 H.264，保持原分辨率
   */
  const buildFFmpegArgs = (
    inputPath: string,
    playlistPath: string,
    segmentPattern: string,
    videoInfo: VideoInfo
  ): string[] => {
    const args: string[] = ['-i', inputPath, '-y'];

    // 视频编码
    if (videoInfo.canCopyVideo) {
      args.push('-c:v', 'copy');
    } else {
      args.push(
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '23',
        '-profile:v',
        'high',
        '-level',
        '4.1'
      );
    }

    // 音频编码
    if (videoInfo.canCopyAudio) {
      args.push('-c:a', 'copy');
    } else {
      args.push('-c:a', 'aac', '-b:a', '128k', '-ac', '2');
    }

    // 线程数 + HLS 参数
    args.push(
      '-threads',
      String(config.FFMPEG_THREADS),
      '-f',
      'hls',
      '-hls_time',
      String(config.FFMPEG_HLS_SEGMENT_TIME),
      '-hls_list_size',
      '0',
      '-hls_segment_type',
      'mpegts',
      '-hls_segment_filename',
      segmentPattern,
      '-hls_playlist_type',
      'vod',
      '-progress',
      'pipe:1',
      playlistPath
    );

    return args;
  };

  /**
   * 解析 FFmpeg progress 输出
   */
  const parseProgressOutput = (
    output: string,
    duration: number
  ): Partial<TranscodeProgress> => {
    const result: Partial<TranscodeProgress> = { duration };

    const outTimeMatch = output.match(/out_time_us=(\d+)/);

    if (outTimeMatch) {
      const currentTime = parseInt(outTimeMatch[1], 10) / 1000000;
      result.currentTime = currentTime;
      if (duration > 0) {
        result.progress = Math.min(
          Math.round((currentTime / duration) * 100),
          99
        );
      }
    }

    const frameMatch = output.match(/frame=(\d+)/);
    if (frameMatch) result.frame = parseInt(frameMatch[1], 10);

    const fpsMatch = output.match(/fps=([\d.]+)/);
    if (fpsMatch) result.fps = parseFloat(fpsMatch[1]);

    const speedMatch = output.match(/speed=([\d.]+)x/);
    if (speedMatch) result.speed = `${speedMatch[1]}x`;

    return result;
  };

  /**
   * 执行 FFmpeg 转码
   */
  const executeFFmpeg = (
    taskId: number,
    inputPath: string,
    playlistPath: string,
    segmentPattern: string,
    videoInfo: VideoInfo
  ): Promise<TranscodeResult> => {
    const args = buildFFmpegArgs(
      inputPath,
      playlistPath,
      segmentPattern,
      videoInfo
    );
    const usedCopy = videoInfo.canCopyVideo && videoInfo.canCopyAudio;
    const taskOutputDir = path.dirname(playlistPath);

    log.info({ taskId, args, usedCopy }, '[FFmpeg] starting transcode');

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(config.FFMPEG_PATH, args);
      activeProcesses.set(taskId, ffmpeg);

      let progressBuffer = '';
      let stderrBuffer = '';

      // 处理进度输出
      ffmpeg.stdout.on('data', async data => {
        progressBuffer += data.toString();
        const lines = progressBuffer.split('\n');
        progressBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.includes('out_time_us') || line.includes('progress=')) {
            const progress = parseProgressOutput(
              progressBuffer + line,
              videoInfo.duration
            );

            if (progress.progress !== undefined) {
              await tasksRepository.updateTranscodeProgress(
                taskId,
                progress.progress
              );
              eventEmitter.emit('progress', {
                taskId,
                progress: progress.progress,
                frame: progress.frame || 0,
                fps: progress.fps || 0,
                speed: progress.speed || '0x',
                currentTime: progress.currentTime || 0,
                duration: videoInfo.duration
              } as TranscodeProgress);
            }
          }
        }
      });

      // 处理错误输出
      ffmpeg.stderr.on('data', data => {
        stderrBuffer += data.toString();
      });

      // 进程结束
      ffmpeg.on('close', async code => {
        activeProcesses.delete(taskId);

        if (code === 0) {
          log.info(
            { taskId, playlistPath, usedCopy },
            '[FFmpeg] transcode completed'
          );
          await tasksRepository.markTranscoded(taskId, playlistPath);

          resolve({
            success: true,
            outputPath: taskOutputDir,
            playlistPath,
            usedCopy,
            duration: videoInfo.duration
          });
        } else {
          const errorMsg = `[FFmpeg] exited with code ${code}`;
          log.error(
            { taskId, code, stderr: stderrBuffer.slice(-1000) },
            errorMsg
          );
          await tasksRepository.markFailed(taskId, errorMsg);

          resolve({
            success: false,
            outputPath: taskOutputDir,
            playlistPath,
            usedCopy,
            duration: videoInfo.duration,
            error: errorMsg
          });
        }
      });

      // 进程错误
      ffmpeg.on('error', async error => {
        activeProcesses.delete(taskId);
        log.error({ taskId, error }, '[FFmpeg] process error');
        await tasksRepository.markFailed(taskId, error.message);
        reject(error);
      });
    });
  };

  /**
   * 执行转码任务
   */
  const transcode = async (
    options: TranscodeOptions
  ): Promise<Result<TranscodeResult, Error>> => {
    const { taskId, inputPath, outputDir } = options;

    // 创建输出目录
    const taskOutputDir = path.join(outputDir, `task_${taskId}`);

    try {
      await fs.mkdir(taskOutputDir, { recursive: true });
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      log.error(
        { taskId, error },
        '[FFmpeg] Failed to create output directory'
      );
      await tasksRepository.markFailed(
        taskId,
        `创建输出目录失败: ${error.message}`
      );
      return err(e instanceof Error ? e : new Error(String(e)));
    }

    const playlistPath = path.join(taskOutputDir, 'index.m3u8');
    const segmentPattern = path.join(taskOutputDir, 'segment_%03d.ts');

    // 获取视频信息
    const videoInfoResult = await toResult(getVideoInfo(inputPath));
    if (videoInfoResult.isErr()) {
      log.error(
        { taskId, error: videoInfoResult.error },
        '[FFmpeg] Failed to get video info'
      );
      await tasksRepository.markFailed(
        taskId,
        `获取视频信息失败: ${videoInfoResult.error.message}`
      );
      return err(videoInfoResult.error);
    }
    const videoInfo = videoInfoResult.value;

    log.info(
      {
        taskId,
        duration: videoInfo.duration,
        isH264: videoInfo.isH264,
        resolution: `${videoInfo.width}x${videoInfo.height}`
      },
      '[FFmpeg] video info retrieved'
    );

    // 更新任务状态为转码中
    const markResult = await tasksRepository.markTranscoding(taskId);
    if (markResult.isErr()) {
      log.error(
        { taskId, error: markResult.error },
        '[FFmpeg] Failed to mark task as transcoding'
      );
      return err(markResult.error);
    }

    // 执行 FFmpeg 转码
    return toResult(
      executeFFmpeg(taskId, inputPath, playlistPath, segmentPattern, videoInfo)
    );
  };

  /**
   * 取消转码任务
   */
  const cancelTranscode = async (
    taskId: number
  ): Promise<Result<boolean, Error>> => {
    const process = activeProcesses.get(taskId);
    if (!process) {
      return err(new Error('Task not found or not running'));
    }

    process.kill('SIGTERM');
    activeProcesses.delete(taskId);

    const result = await tasksRepository.markFailed(taskId, '用户取消转码');
    if (result.isErr()) {
      return err(result.error);
    }

    log.info({ taskId }, 'Transcode cancelled');
    return toResult(Promise.resolve(true));
  };

  /**
   * 获取转码状态
   */
  const getTranscodeStatus = (taskId: number) => {
    return {
      isRunning: activeProcesses.has(taskId)
    };
  };

  /**
   * 订阅进度事件
   */
  const onProgress = (callback: (progress: TranscodeProgress) => void) => {
    eventEmitter.on('progress', callback);
    return () => eventEmitter.off('progress', callback);
  };

  /**
   * 获取活跃任务数
   */
  const getActiveCount = () => activeProcesses.size;

  return {
    transcode,
    cancelTranscode,
    getTranscodeStatus,
    onProgress,
    getActiveCount,
    getVideoInfo: (inputPath: string) => toResult(getVideoInfo(inputPath))
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const service = createFFmpegService(fastify);
    fastify.decorate('ffmpegService', service);
  },
  {
    name: 'ffmpeg-service',
    dependencies: ['@fastify/env', 'tasks-repository']
  }
);
