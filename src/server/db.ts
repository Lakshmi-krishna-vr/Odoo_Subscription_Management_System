import { PrismaClient } from "@prisma/client";

/**
 * One Prisma client per process. Next.js reloads modules in development, so the
 * instance is cached on globalThis to avoid opening a new pool on every edit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
