import type { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/server/db";

const OUTSTANDING_STATUSES: InvoiceStatus[] = ["confirmed", "partially_paid", "overdue"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CustomerStanding {
  activeSubscriptions: number;
  outstanding: number;
}

export async function customerStandings(
  customerIds: string[],
): Promise<Map<string, CustomerStanding>> {
  const [subscriptionCounts, unpaidSums] = await Promise.all([
    prisma.subscription.groupBy({
      by: ["customerId"],
      where: { customerId: { in: customerIds }, status: "active" },
      _count: { _all: true },
    }),
    prisma.invoice.groupBy({
      by: ["customerId"],
      where: {
        customerId: { in: customerIds },
        status: { in: OUTSTANDING_STATUSES },
        amountPaid: { lt: prisma.invoice.fields.total },
      },
      _sum: { total: true, amountPaid: true },
    }),
  ]);

  const standings = new Map<string, CustomerStanding>(
    customerIds.map((customerId) => [customerId, { activeSubscriptions: 0, outstanding: 0 }]),
  );
  for (const row of subscriptionCounts) {
    const standing = standings.get(row.customerId);
    if (standing) standing.activeSubscriptions = row._count._all;
  }
  for (const row of unpaidSums) {
    const standing = standings.get(row.customerId);
    if (standing) standing.outstanding = (row._sum.total ?? 0) - (row._sum.amountPaid ?? 0);
  }
  return standings;
}

export interface CustomerDetails {
  contactName: string;
  email: string;
  phone: string;
  address: string;
  paymentTermsDays: number;
}

export async function updateCustomerDetails(
  customerId: string,
  details: CustomerDetails,
): Promise<void> {
  const contactName = details.contactName.trim();
  const email = details.email.trim().toLowerCase();
  const phone = details.phone.trim();
  const address = details.address.trim();

  if (!contactName) throw new Error("Enter a contact name.");
  if (!EMAIL.test(email)) throw new Error("Enter a valid email address.");
  if (
    !Number.isInteger(details.paymentTermsDays) ||
    details.paymentTermsDays < 0 ||
    details.paymentTermsDays > 365
  ) {
    throw new Error("Payment terms must be a whole number of days from 0 to 365.");
  }

  const updated = await prisma.customer.updateMany({
    where: { id: customerId },
    data: {
      contactName,
      email,
      phone: phone || null,
      address: address || null,
      paymentTermsDays: details.paymentTermsDays,
    },
  });
  if (updated.count === 0) throw new Error("Customer not found.");
}
