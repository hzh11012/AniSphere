import { err, fromPromise, ok, Result } from 'neverthrow';

/**
 * 将未知异常转换为标准 Error 对象
 */
export const normalizeError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));

/**
 * 将未知异常转换为 Result<never, Error>
 */
export const toErr = (e: unknown): Result<never, Error> =>
  err(normalizeError(e));

/**
 * 包装 async 函数，返回 Result
 */
export const toResult = <T>(promise: Promise<T>) =>
  fromPromise(promise, normalizeError);

/**
 * 包装同步函数，返回 Result
 */
export const toSyncResult = <T>(fn: () => T): Result<T, Error> => {
  try {
    return ok(fn());
  } catch (e: unknown) {
    return toErr(e);
  }
};
