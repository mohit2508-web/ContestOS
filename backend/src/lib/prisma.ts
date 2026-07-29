import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: any };

export const prisma = (globalForPrisma.prisma || new PrismaClient({
  log: ["error", "warn"],
})) as PrismaClient & Record<string, any>;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
