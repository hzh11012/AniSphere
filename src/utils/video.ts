import path from 'node:path';

/** 支持的视频格式 */
export const VIDEO_EXTENSIONS = ['.mp4'];

/** 可直接播放的格式 */
export const DIRECT_PLAY_EXTENSIONS = ['.mp4'];

/**
 * 检查是否为支持的视频文件
 */
export function isVideoFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

/**
 * 检查是否需要转码
 * MP4 格式不需要转码（直接转 HLS）
 */
export function needsTranscode(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return !DIRECT_PLAY_EXTENSIONS.includes(ext);
}
