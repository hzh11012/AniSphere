import { pinyin } from 'pinyin-pro';

export function toPinyin(name: string): string {
  return pinyin(name, { toneType: 'none', separator: '' });
}

export function toInitials(name: string): string {
  return pinyin(name, { pattern: 'first', toneType: 'none', separator: '' });
}

export function highlight(name: string, keyword: string): string {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return name.replace(
    new RegExp(escaped, 'gi'),
    m => `<em class="keyword">${m}</em>`
  );
}
