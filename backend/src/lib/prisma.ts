import { PrismaClient } from "../generated/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient & Record<string, any>;
  prismaKeepAliveStarted?: boolean;
};

export const prisma = (globalForPrisma.prisma || new PrismaClient({
  log: ["error", "warn"],
})) as PrismaClient & Record<string, any>;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// 🟢 Heartbeat Ping: Keeps CockroachDB Cloud connection warm & prevents auto-sleep
if (!globalForPrisma.prismaKeepAliveStarted) {
  globalForPrisma.prismaKeepAliveStarted = true;
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      try {
        await prisma.$connect();
      } catch {}
    }
  }, 30 * 1000); // Heartbeat ping every 30 seconds
}

/**
 * 🟢 Resilient query execution wrapper with automatic reconnect retry on CockroachDB connection loss / P1001 / P1002
 */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 800): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isConnError =
        err?.code === 'P1001' ||
        err?.code === 'P1002' ||
        err?.message?.includes("Can't reach database server") ||
        err?.message?.includes("Timed out fetching a new connection") ||
        err?.message?.includes("Closed") ||
        err?.message?.includes("connection: Error") ||
        err?.message?.includes("kind: Closed");
      if (isConnError && attempt < retries) {
        console.warn(`[Prisma DB Retry] Connection drop detected (attempt ${attempt}/${retries}). Reconnecting in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
        try {
          await prisma.$connect();
        } catch {
          // Reconnect attempt error ignored
        }
      } else {
        throw err;
      }
    }
  }
  return await fn();
}

export default prisma;
