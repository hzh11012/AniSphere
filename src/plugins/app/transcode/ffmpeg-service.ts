import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import type { Result } from 'neverthrow';
import { err, ok, toResult } from '../../../utils/result.js';
import { VIDEO_EXTENSIONS } from '../../../utils/video.js';

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
  duration: number;
  width: number;
  height: number;
  isH264: boolean;
  isAAC: boolean;
}

interface HardwareEncoder {
  name: string;
  encoder: string;
  hwaccel?: string;
  hwaccelOutputFormat?: string;
  scaleFilter: string;
  extraArgs: string[];
}

interface ActiveTask {
  process: ChildProcess;
  outputDir: string;
}

/** 最大输出高度（仅对非 H.264 视频生效） */
const MAX_HEIGHT = 1080;

/** 编码器配置 */
const ENCODERS: Record<string, HardwareEncoder> = {
  qsv: {
    name: 'Intel QSV',
    encoder: 'h264_qsv',
    hwaccel: 'qsv',
    hwaccelOutputFormat: 'qsv',
    scaleFilter: 'scale_qsv',
    extraArgs: ['-preset', 'medium', '-global_quality', '23']
  },
  nvenc: {
    name: 'NVIDIA NVENC',
    encoder: 'h264_nvenc',
    hwaccel: 'cuda',
    hwaccelOutputFormat: 'cuda',
    scaleFilter: 'scale_cuda',
    extraArgs: ['-preset', 'p4', '-cq', '23']
  },
  videotoolbox: {
    name: 'Apple VideoToolbox',
    encoder: 'h264_videotoolbox',
    scaleFilter: 'scale',
    extraArgs: ['-q:v', '65']
  },
  software: {
    name: 'Software (libx264)',
    encoder: 'libx264',
    scaleFilter: 'scale',
    extraArgs: [
      '-preset',
      'medium',
      '-crf',
      '23',
      '-profile:v',
      'high',
      '-level',
      '4.1'
    ]
  }
};

/** 编码器检测优先级 */
const ENCODER_PRIORITY = ['qsv', 'nvenc', 'videotoolbox', 'software'];

const createFFmpegService = (fastify: FastifyInstance) => {
  const { config, log, tasksRepository } = fastify;
  const activeProcesses = new Map<number, ActiveTask>();
  const eventEmitter = new EventEmitter();

  // 任务队列（内存）
  const taskQueue: TranscodeOptions[] = [];
  let isProcessing = false;

  // 检测到的编码器
  let detectedEncoder: HardwareEncoder = ENCODERS.software;

  //初始化方法
  const initialize = async () => {
    detectedEncoder = await detectEncoder();
    log.info({ encoder: detectedEncoder.name }, '[FFmpeg] encoder initialized');
  };

  /**
   * 检测可用的硬件编码器
   */
  const detectEncoder = async (): Promise<HardwareEncoder> => {
    return new Promise(resolve => {
      const ffmpeg = spawn(config.FFMPEG_PATH, ['-encoders']);
      let stdout = '';

      ffmpeg.stdout.on('data', data => {
        stdout += data.toString();
      });

      ffmpeg.on('close', () => {
        for (const key of ENCODER_PRIORITY) {
          const encoder = ENCODERS[key];
          if (stdout.includes(encoder.encoder)) {
            resolve(encoder);
            return;
          }
        }
        resolve(ENCODERS.software);
      });

      ffmpeg.on('error', () => resolve(ENCODERS.software));
    });
  };

  /**
   * 检查文件格式是否支持
   */
  const isSupportedFormat = (filePath: string): boolean => {
    const ext = path.extname(filePath).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  };

  /**
   * 使用 ffprobe 获取视频信息（编码 + 时长）
   */
  const getVideoInfo = async (inputPath: string): Promise<VideoInfo> => {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        inputPath
      ]);
      let stdout = '';

      ffprobe.stdout.on('data', data => {
        stdout += data.toString();
      });

      ffprobe.on('close', code => {
        if (code !== 0) {
          resolve({
            duration: 0,
            width: 0,
            height: 0,
            isH264: false,
            isAAC: false
          });
          return;
        }

        try {
          const info = JSON.parse(stdout);
          const videoStream = info.streams?.find(
            (s: { codec_type: string }) => s.codec_type === 'video'
          );
          const audioStream = info.streams?.find(
            (s: { codec_type: string }) => s.codec_type === 'audio'
          );

          const videoCodec = videoStream?.codec_name || 'unknown';
          const audioCodec = audioStream?.codec_name || 'unknown';

          resolve({
            duration: parseFloat(info.format?.duration) || 0,
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            isH264: ['h264', 'avc1', 'avc'].includes(videoCodec.toLowerCase()),
            isAAC: ['aac', 'mp4a'].includes(audioCodec.toLowerCase())
          });
        } catch {
          resolve({
            duration: 0,
            width: 0,
            height: 0,
            isH264: false,
            isAAC: false
          });
        }
      });

      ffprobe.on('error', reject);
    });
  };

  /**
   * 构建 FFmpeg 参数
   * - H.264：直接复制
   * - 非 H.264：硬件编码，限制最大 1080p
   */
  const buildFFmpegArgs = (
    inputPath: string,
    playlistPath: string,
    segmentPattern: string,
    videoInfo: VideoInfo,
    encoder: HardwareEncoder
  ): string[] => {
    const args: string[] = [];
    const needsScale = !videoInfo.isH264 && videoInfo.height > MAX_HEIGHT;

    // H.264：直接复制
    if (videoInfo.isH264) {
      args.push('-i', inputPath, '-y', '-c:v', 'copy');
    } else {
      // 非 H.264：硬件编码
      if (encoder.hwaccel) {
        args.push('-hwaccel', encoder.hwaccel);
        if (encoder.hwaccelOutputFormat) {
          args.push('-hwaccel_output_format', encoder.hwaccelOutputFormat);
        }
      }

      args.push('-i', inputPath, '-y', '-c:v', encoder.encoder);
      args.push(...encoder.extraArgs);

      // 缩放（仅非 H.264 且 > 1080p）
      if (needsScale) {
        const scale =
          encoder.scaleFilter === 'scale'
            ? `-2:${MAX_HEIGHT}`
            : `w=-1:h=${MAX_HEIGHT}`;
        args.push('-vf', `${encoder.scaleFilter}=${scale}`);
      }
    }

    // 音频
    if (videoInfo.isAAC) {
      args.push('-c:a', 'copy');
    } else {
      args.push('-c:a', 'aac', '-b:a', '128k');
    }

    // HLS 参数
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
   * 解析进度
   */
  const parseProgress = (
    output: string,
    duration: number
  ): Partial<TranscodeProgress> => {
    const result: Partial<TranscodeProgress> = { duration };

    const timeMatch = output.match(/out_time_us=(\d+)/);
    if (timeMatch) {
      const currentTime = parseInt(timeMatch[1], 10) / 1000000;
      result.currentTime = currentTime;
      result.progress =
        duration > 0
          ? Math.min(Math.round((currentTime / duration) * 100), 99)
          : 0;
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
   * 执行单个转码
   */
  const executeTranscode = async (
    options: TranscodeOptions
  ): Promise<Result<TranscodeResult, Error>> => {
    const { taskId, inputPath, outputDir } = options;

    // 检查文件格式
    if (!isSupportedFormat(inputPath)) {
      const errorMsg = `不支持的文件格式，仅支持: ${VIDEO_EXTENSIONS.join(', ')}`;
      await tasksRepository.markFailed(taskId, errorMsg);
      return err(new Error(errorMsg));
    }

    const taskOutputDir = path.join(outputDir, `task_${taskId}`);

    try {
      await fs.mkdir(taskOutputDir, { recursive: true });
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      await tasksRepository.markFailed(
        taskId,
        `创建目录失败: ${error.message}`
      );
      return err(error);
    }

    const playlistPath = path.join(taskOutputDir, 'index.m3u8');
    const segmentPattern = path.join(taskOutputDir, 'segment_%03d.ts');

    // 获取视频信息
    const videoInfoResult = await toResult(getVideoInfo(inputPath));
    if (videoInfoResult.isErr()) {
      await tasksRepository.markFailed(taskId, `获取视频信息失败`);
      return err(videoInfoResult.error);
    }
    const videoInfo = videoInfoResult.value;

    log.info(
      {
        taskId,
        resolution: `${videoInfo.width}x${videoInfo.height}`,
        isH264: videoInfo.isH264,
        encoder: videoInfo.isH264 ? 'copy' : detectedEncoder.name
      },
      '[FFmpeg] starting transcode'
    );

    await tasksRepository.markTranscoding(taskId);

    const args = buildFFmpegArgs(
      inputPath,
      playlistPath,
      segmentPattern,
      videoInfo,
      detectedEncoder
    );
    const usedCopy = videoInfo.isH264 && videoInfo.isAAC;

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(config.FFMPEG_PATH, args);
      activeProcesses.set(taskId, {
        process: ffmpeg,
        outputDir: taskOutputDir
      });

      let progressBuffer = '';
      let stderrBuffer = '';

      ffmpeg.stdout.on('data', async data => {
        progressBuffer += data.toString();
        const lines = progressBuffer.split('\n');
        progressBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.includes('out_time_us')) {
            const progress = parseProgress(
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
                ...progress
              } as TranscodeProgress);
            }
          }
        }
      });

      ffmpeg.stderr.on('data', data => {
        stderrBuffer += data.toString();
      });

      ffmpeg.on('close', async code => {
        activeProcesses.delete(taskId);

        if (code === 0) {
          await tasksRepository.markTranscoded(taskId, playlistPath);
          resolve(
            ok({
              success: true,
              outputPath: taskOutputDir,
              playlistPath,
              usedCopy,
              duration: videoInfo.duration
            })
          );
        } else {
          const errorMsg = `[FFmpeg] exited with code ${code}`;
          log.error({ taskId, stderr: stderrBuffer.slice(-500) }, errorMsg);
          await tasksRepository.markFailed(taskId, errorMsg);
          resolve(
            ok({
              success: false,
              outputPath: taskOutputDir,
              playlistPath,
              usedCopy,
              duration: videoInfo.duration,
              error: errorMsg
            })
          );
        }
      });

      ffmpeg.on('error', async error => {
        activeProcesses.delete(taskId);
        await tasksRepository.markFailed(taskId, error.message);
        reject(error);
      });
    });
  };

  /**
   * 处理队列
   */
  const processQueue = async () => {
    if (isProcessing || taskQueue.length === 0) return;

    isProcessing = true;
    const task = taskQueue.shift()!;

    log.info(
      { taskId: task.taskId, remaining: taskQueue.length },
      '[FFmpeg] processing from queue'
    );

    try {
      await executeTranscode(task);
    } catch (error) {
      log.error({ taskId: task.taskId, error }, '[FFmpeg] task failed');
    } finally {
      isProcessing = false;
      if (taskQueue.length > 0) {
        setImmediate(processQueue);
      }
    }
  };

  /**
   * 添加任务到队列
   */
  const transcode = async (
    options: TranscodeOptions
  ): Promise<Result<{ queued: boolean; position: number }, Error>> => {
    const { taskId, inputPath } = options;

    // 检查文件格式
    if (!isSupportedFormat(inputPath)) {
      return err(
        new Error(`不支持的文件格式，仅支持: ${VIDEO_EXTENSIONS.join(', ')}`)
      );
    }

    // 检查是否已在队列或处理中
    if (
      taskQueue.some(t => t.taskId === taskId) ||
      activeProcesses.has(taskId)
    ) {
      return err(new Error('任务已在队列中或正在处理'));
    }

    taskQueue.push(options);
    const position = taskQueue.length;

    log.info({ taskId, position }, '[FFmpeg] task queued');

    // 触发处理
    setImmediate(processQueue);

    return ok({ queued: true, position });
  };

  /**
   * 取消任务
   */
  const cancelTranscode = async (
    taskId: number
  ): Promise<Result<boolean, Error>> => {
    // 从队列移除
    const queueIndex = taskQueue.findIndex(t => t.taskId === taskId);
    if (queueIndex !== -1) {
      taskQueue.splice(queueIndex, 1);
      await tasksRepository.markFailed(taskId, '用户取消');
      return ok(true);
    }

    // 终止进程
    const activeTask = activeProcesses.get(taskId);
    if (activeTask) {
      const { process, outputDir } = activeTask;

      // 终止进程
      process.kill('SIGTERM');
      activeProcesses.delete(taskId);

      // 等待进程完全退出后清理文件
      await new Promise<void>(resolve => {
        process.once('close', () => resolve());
        // 设置超时，防止进程无法正常退出
        setTimeout(() => resolve(), 200);
      });

      // 清理输出文件
      try {
        await fs.rm(outputDir, { recursive: true, force: true });
      } catch (error) {
        log.warn(
          { taskId, outputDir, error },
          '[FFmpeg] failed to cleanup cancelled task output'
        );
      }

      await tasksRepository.markFailed(taskId, '用户取消');
      return ok(true);
    }

    return err(new Error('任务不存在'));
  };

  return {
    initialize,
    transcode,
    cancelTranscode,
    getTranscodeStatus: (taskId: number) => ({
      isRunning: activeProcesses.has(taskId)
    }),
    onProgress: (cb: (p: TranscodeProgress) => void) => {
      eventEmitter.on('progress', cb);
      return () => eventEmitter.off('progress', cb);
    },
    getActiveCount: () => activeProcesses.size,
    getQueueLength: () => taskQueue.length,
    getEncoderInfo: () => detectedEncoder,
    getVideoInfo: (p: string) => toResult(getVideoInfo(p)),
    isSupportedFormat
  };
};

export default fp(
  async (fastify: FastifyInstance) => {
    const service = createFFmpegService(fastify);
    await service.initialize();
    fastify.decorate('ffmpegService', service);
  },
  {
    name: 'ffmpeg-service',
    dependencies: ['@fastify/env', 'tasks-repository']
  }
);
