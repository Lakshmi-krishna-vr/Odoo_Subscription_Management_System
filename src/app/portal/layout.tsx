import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["customer"]);
  return <>{children}</>;
}
