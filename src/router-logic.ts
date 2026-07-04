export function shouldFallback(status: number): boolean {
  return (
    status === 401 ||
    status === 402 ||
    status === 403 ||
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500
  );
}

export function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type AttemptFailure = {
  provider: string;
  model: string;
  status?: number;
  reason: string;
};
