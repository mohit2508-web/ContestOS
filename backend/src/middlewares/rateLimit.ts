import { Request, Response, NextFunction } from "express";

const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxAttempts: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip}:${req.route?.path || req.path}`;
    const now = Date.now();
    const record = attempts.get(key);

    if (record && record.resetAt > now) {
      if (record.count >= maxAttempts) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        res.set('Retry-After', String(retryAfter));
        res.status(429).json({
          error: `Too many requests. Try again in ${retryAfter} seconds.`,
        });
        return;
      }
      record.count++;
    } else {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
    }

    next();
  };
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts.entries()) {
    if (record.resetAt < now) {
      attempts.delete(key);
    }
  }
}, 5 * 60 * 1000);
