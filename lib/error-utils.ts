/**
 * Safely extract a user-friendly error message from an unknown catch value.
 * Never returns 'undefined' or '[object Object]'.
 */
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'An unexpected error occurred.';
}