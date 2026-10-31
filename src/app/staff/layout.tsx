import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["admin", "staff"]);
  return <>{children}</>;
}
