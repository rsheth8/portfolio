/**
 * An AbortSignal that fires after `ms`. Uses AbortSignal.timeout where
 * available, with an AbortController fallback for older Safari (< 16) and any
 * browser that predates AbortSignal.timeout — otherwise these fetches throw
 * synchronously on those browsers and the music/streaming features break.
 */
export function timeoutSignal(ms: number): AbortSignal {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}
