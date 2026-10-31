// temporary helper — not committed
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import { compareSync } from "bcryptjs";

const prisma = new PrismaClient();
const secret = (readFileSync(".env", "utf8").match(/^AUTH_SECRET=(.*)$/m)?.[1] ?? "").replace(/^"|"$/g, "");

async function token(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`no user ${email}`);
  return new SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("3h")
    .sign(new TextEncoder().encode(secret));
}

// create a staff account the same way the admin form does, then prove it can sign in
const email = "priya@brightloop.test";
const existing = await prisma.user.findUnique({ where: { email } });
if (!existing) {
  const { hashSync } = await import("bcryptjs");
  const { randomUUID } = await import("node:crypto");
  await prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      passwordHash: hashSync("Brightloop#2026", 10),
      name: "Priya (new staff)",
      role: "staff",
      isActive: true,
    },
  });
  console.log("created staff account:", email);
}
const created = await prisma.user.findUnique({ where: { email } });
console.log("staff password verifies:", compareSync("Brightloop#2026", created!.passwordHash), "| role:", created!.role);

console.log(
  JSON.stringify({
    admin: await token("admin@brightloop.test"),
    staff: await token("staff@brightloop.test"),
    customer: await token("customer@brightloop.test"),
    newStaff: await token(email),
  }),
);
await prisma.$disconnect();
