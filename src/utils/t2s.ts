import * as OpenCC from 'opencc-js';

/** 繁体→简体转换器（单例） */
const converter = OpenCC.Converter({ from: 't', to: 'cn' });

/**
 * 将文本从繁体中文转换为简体中文
 * 如果输入为空则原样返回
 */
export function t2s(text: string): string {
  return converter(text);
}
