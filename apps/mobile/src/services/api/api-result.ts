import { err, ok, type Result } from "@sacou/volley-rules";

import { ApiFailure, type ApiError } from "./api-error";

/** What every method of the `SacouApi` resolves to: the error is a value, not an exception. */
export type ApiResult<T> = Result<T, ApiError>;

export const apiOk = <T>(value: T): ApiResult<T> => ok(value);
export const apiErr = <T = never>(error: ApiError): ApiResult<T> => err(error);

/** The one place where an `ApiResult` becomes a throw: a `queryFn` or a `mutationFn` (D5). */
export async function unwrap<T>(result: Promise<ApiResult<T>>): Promise<T> {
  const settled = await result;
  if (!settled.ok) throw new ApiFailure(settled.error);
  return settled.value;
}
