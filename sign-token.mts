// temporary verification helper — not committed
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";

const email = process.argv[2];
const env = readFileSync(".env", "utf8");
const secret = env.match(/^AUTH_SECRET=(.*)$/m)?.[1]?.replace(/^"|"$/g, "") ?? "";
if (!secret) throw new Error("no AUTH_SECRET");

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({ where: { email } });
if (!user) throw new Error("no such user");

const token = await new SignJWT({ sub: user.id })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(secret));

console.log(token);
await prisma.$disconnect();
