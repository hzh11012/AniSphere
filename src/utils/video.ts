import path from 'node:path';

/** 支持的视频格式 */
export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mkv',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.webm',
  '.m4v',
  '.ts',
  '.rmvb',
  '.rm'
];

/**
 * 检查是否为支持的视频文件
 */
export function isVideoFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}
