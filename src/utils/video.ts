import path from 'node:path';

export const VIDEO_EXTENSIONS = [
  '.mkv',
  '.mp4',
  '.avi',
  '.wmv',
  '.flv',
  '.mov',
  '.webm',
  '.m4v',
  '.ts',
  '.mts',
  '.m2ts'
];

export const DIRECT_PLAY_EXTENSIONS = ['.mp4'];

export function isVideoFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

export function needsTranscode(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return !DIRECT_PLAY_EXTENSIONS.includes(ext);
}
