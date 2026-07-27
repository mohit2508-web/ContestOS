export function safeParseInt(value: string | undefined | null, fallback: number): number {
  if (value == null) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function safeParseIntPositive(value: string | undefined | null, fallback: number): number {
  const parsed = safeParseInt(value, fallback);
  return parsed > 0 ? parsed : fallback;
}
