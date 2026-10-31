import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { NewStaffForm, ToggleStaffButton } from "./new-form";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function StaffAdminPage() {
  const actor = await requireRole(["admin"]);

  const users = await prisma.user.findMany({
    where: { role: { in: ["admin", "staff"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  const staffCount = users.filter((user) => user.role === "staff").length;

  return (
    <Shell role="admin">
      <PageHeader
        title="Staff"
        subtitle="Only the admin can add a member of staff."
        right={<Badge>{staffCount} staff</Badge>}
      />

      <Card
        title="Add a member of staff"
        description="They sign in with this email and password; staff see the operations screens, not this one."
      >
        <NewStaffForm />
      </Card>

      <Card title="Accounts" description="Admins and staff. Customers sign themselves up.">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-[var(--muted)]">
                  No accounts yet.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="font-medium">{user.name}</td>
                  <td className="text-[var(--muted)]">{user.email}</td>
                  <td>
                    <Badge>{user.role}</Badge>
                  </td>
                  <td>
                    <span className={user.isActive ? "" : "text-[var(--muted)]"}>
                      {user.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td>{formatDate(user.lastLoginAt)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td className="text-right">
                    <ToggleStaffButton
                      userId={user.id}
                      isActive={user.isActive}
                      isSelf={user.id === actor.id}
                      isAdmin={user.role === "admin"}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}
