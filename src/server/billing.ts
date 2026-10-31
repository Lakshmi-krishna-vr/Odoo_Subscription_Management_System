import { randomUUID } from "node:crypto";
import { Prisma, SubStatus, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { periodEnd } from "@/core/periods";
import type { DiscountRule, TaxRule } from "@/contracts";
import { priceSubscription } from "@/server/price-subscription";

export { priceSubscription };

export interface BillingPreviewRow {
  subscriptionNumber: string;
  customer: string;
  periodStart: string;
  total: number;
  appliedDiscounts: {
    discountId: string;
    name: string;
    amount: number;
  }[];
}

export interface BillingRunResult {
  asOf: string;
  dryRun: boolean;
  considered: number;
  created: number;
  skipped: number;
  errors: { subscriptionId: string; message: string }[];
  totalValue: number;
  preview: BillingPreviewRow[];
  durationMs: number;
}

/**
 * Work is done in batches: pricing is pure and local, so the only cost that
 * matters is round trips. One transaction per batch of 100 keeps a run over
 * hundreds of subscriptions at a couple of seconds instead of a couple of
 * minutes.
 */
const BATCH = 100;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Current calendar date in Indian Standard Time. */
export const todayIST = () =>
  new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

/**
 * Create the invoices that are due on `asOf`.
 *
 * Two promises from the brief are kept structurally, not by being careful:
 *  - nothing is billed twice: UNIQUE(subscription_id, period_start) makes a
 *    second invoice for the same period impossible, and anything already
 *    invoiced is counted as skipped;
 *  - nothing is skipped: the query takes every active subscription whose
 *    nextBillingDate has already passed, so a missed day is caught up next run.
 */
export async function runBilling(
  asOfInput: string,
  options: { dryRun: boolean; triggeredBy?: string },
): Promise<BillingRunResult> {
  const startedAt = Date.now();
  const asOf = new Date(`${asOfInput}T00:00:00Z`);
  if (Number.isNaN(asOf.getTime())) throw new Error("invalid asOf date");

  const [taxes, discounts, redemptions] = await Promise.all([
    prisma.tax.findMany(),
    prisma.discount.findMany({ where: { isActive: true } }),
    prisma.discountRedemption.groupBy({
      by: ["discountId", "customerId"],
      _count: { _all: true },
    }),
  ]);

  const redemptionCount = new Map<string, number>();
  for (const row of redemptions) {
    redemptionCount.set(`${row.discountId}:${row.customerId}`, row._count._all);
  }

  const taxRules: TaxRule[] = taxes.map((tax) => ({
    id: tax.id,
    name: tax.name,
    rateBp: tax.rateBp,
  }));

  const discountRules: DiscountRule[] = discounts.map((discount) => ({
    id: discount.id,
    name: discount.name,
    type: discount.type,
    value: discount.value,
    scope: discount.scope,
    productIds: discount.productIds,
    minPurchase: discount.minPurchase,
    minQuantity: discount.minQuantity,
    startsAt: discount.startsAt ? isoDate(discount.startsAt) : null,
    endsAt: discount.endsAt ? isoDate(discount.endsAt) : null,
    usageLimit: discount.usageLimit,
    perCustomerLimit: discount.perCustomerLimit,
    usedCount: discount.usedCount,
    isActive: discount.isActive,
  }));

  const discountNameById = new Map(discountRules.map((d) => [d.id, d.name]));

  const runUse = new Map<string, number>();
  const runTotal = new Map<string, number>();
  const persistedCounts = new Map<string, number>();

  const rulesFor = (customerId: string) =>
    discountRules.filter((rule) => {
      const before = redemptionCount.get(`${rule.id}:${customerId}`) ?? 0;
      if (
        rule.perCustomerLimit !== null &&
        before + (runUse.get(`${rule.id}:${customerId}`) ?? 0) >= rule.perCustomerLimit
      ) {
        return false;
      }
      if (
        rule.usageLimit !== null &&
        rule.usedCount + (runTotal.get(rule.id) ?? 0) >= rule.usageLimit
      ) {
        return false;
      }
      return true;
    });

  const result: BillingRunResult = {
    asOf: asOfInput,
    dryRun: options.dryRun,
    considered: 0,
    created: 0,
    skipped: 0,
    errors: [],
    totalValue: 0,
    preview: [],
    durationMs: 0,
  };

  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.subscription.findMany({
      where: { status: SubStatus.active, nextBillingDate: { lte: asOf } },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(options.dryRun && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { customer: true, plan: true, lines: true },
    });

    if (batch.length === 0) break;
    if (options.dryRun) cursor = batch[batch.length - 1].id;
    result.considered += batch.length;
    const progressBefore = result.created + result.skipped;

    const runUseBeforeBatch = new Map(runUse);
    const runTotalBeforeBatch = new Map(runTotal);

    // price every subscription in the batch (pure, no I/O)
    const priced = batch.map((subscription) => {
      const startIso = isoDate(subscription.nextBillingDate);
      const customerRedemptions: Record<string, number> = {};
      for (const rule of discountRules) {
        customerRedemptions[rule.id] =
          (redemptionCount.get(`${rule.id}:${subscription.customerId}`) ?? 0) +
          (runUse.get(`${rule.id}:${subscription.customerId}`) ?? 0);
      }

      const pricedSubscription = priceSubscription({
        subscription,
        taxRules,
        discountRules: rulesFor(subscription.customerId),
        customerRedemptions,
        periodStart: startIso,
      });

      for (const applied of pricedSubscription.doc.appliedDiscounts) {
        const key = `${applied.discountId}:${subscription.customerId}`;
        runUse.set(key, (runUse.get(key) ?? 0) + 1);
        runTotal.set(applied.discountId, (runTotal.get(applied.discountId) ?? 0) + 1);
      }

      return { subscription, ...pricedSubscription };
    });

    result.totalValue += priced.reduce((sum, row) => sum + row.doc.total, 0);

    if (options.dryRun) {
      for (const row of priced) {
        result.preview.push({
          subscriptionNumber: row.subscription.number,
          customer: row.subscription.customer.companyName,
          periodStart: row.startIso,
          total: row.doc.total,
          appliedDiscounts: row.doc.appliedDiscounts.map((applied) => ({
            discountId: applied.discountId,
            name: discountNameById.get(applied.discountId) ?? "Discount",
            amount: applied.amount,
          })),
        });
      }
      continue;
    }

    // which of these already have an invoice for that period?
    const periodStarts = priced.map((row) => new Date(`${row.startIso}T00:00:00Z`));
    const desiredPairs = new Set(
      priced.map((row) => `${row.subscription.id}:${row.startIso}`),
    );
    const existing = await prisma.invoice.findMany({
      where: {
        subscriptionId: { in: priced.map((row) => row.subscription.id) },
        periodStart: { in: periodStarts },
      },
      select: { subscriptionId: true, periodStart: true },
    });
    const alreadyInvoiced = new Set(
      existing.flatMap((row) => {
        if (!row.periodStart) return [];
        const key = `${row.subscriptionId}:${isoDate(row.periodStart)}`;
        return desiredPairs.has(key) ? [key] : [];
      }),
    );

    const todo = priced.filter(
      (row) => !alreadyInvoiced.has(`${row.subscription.id}:${row.startIso}`),
    );
    result.skipped += priced.length - todo.length;

    if (todo.length === 0) {
      // every subscription in this batch was already invoiced; the rows no
      // longer match the due filter, so stop instead of re-reading them
      if (!options.dryRun) break;
      continue;
    }

    const invoices = todo.map((row) => ({
      id: randomUUID(),
      subscriptionId: row.subscription.id,
      customerId: row.subscription.customerId,
      periodStart: new Date(`${row.startIso}T00:00:00Z`),
      periodEnd: new Date(`${row.endIso}T00:00:00Z`),
      invoiceDate: asOf,
      dueDate: new Date(`${row.dueIso}T00:00:00Z`),
      status: InvoiceStatus.draft,
      subtotal: row.doc.subtotal,
      discountTotal: row.doc.discountTotal,
      taxTotal: row.doc.taxTotal,
      total: row.doc.total,
      amountPaid: 0,
    }));

    const lines = todo.flatMap((row, index) =>
      row.doc.lines.map((line) => ({
        id: randomUUID(),
        invoiceId: invoices[index].id,
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxableAmount: line.taxableAmount,
        taxRateBp: line.taxRateBp,
        taxAmount: line.taxAmount,
        lineTotal: line.lineTotal,
      })),
    );

    const redemptionRows = todo.flatMap((row, index) =>
      row.doc.appliedDiscounts.map((applied) => ({
        id: randomUUID(),
        discountId: applied.discountId,
        invoiceId: invoices[index].id,
        customerId: row.subscription.customerId,
        amount: applied.amount,
      })),
    );

    try {
      await prisma.$transaction(async (tx) => {
        await tx.invoice.createMany({ data: invoices });
        if (lines.length > 0) await tx.invoiceLine.createMany({ data: lines });
        if (redemptionRows.length > 0) {
          await tx.discountRedemption.createMany({ data: redemptionRows });

          for (const [discountId, total] of runTotal) {
            const alreadyPersisted = persistedCounts.get(discountId) ?? 0;
            const count = total - alreadyPersisted;
            if (count > 0) {
              await tx.discount.update({
                where: { id: discountId },
                data: { usedCount: { increment: count } },
              });
            }
          }
        }

        // advance every subscription in one statement
        const values = Prisma.join(
          todo.map(
            (row) =>
              Prisma.sql`(${row.subscription.id}::uuid, ${row.endIso}::date, ${periodEnd(
                row.endIso,
                row.subscription.plan.billingPeriod,
                row.subscription.plan.intervalCount,
              )}::date)`,
          ),
        );
        await tx.$executeRaw`
          UPDATE subscriptions AS s
             SET next_billing_date = v.next_date,
                 period_start      = v.next_date,
                 period_end        = v.period_end,
                 updated_at        = now()
            FROM (VALUES ${values}) AS v(id, next_date, period_end)
           WHERE s.id = v.id`;
      });

      for (const [discountId, total] of runTotal) {
        persistedCounts.set(discountId, total);
      }

      result.created += todo.length;
    } catch (error) {
      runUse.clear();
      for (const [k, v] of runUseBeforeBatch) runUse.set(k, v);
      runTotal.clear();
      for (const [k, v] of runTotalBeforeBatch) runTotal.set(k, v);

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // A concurrent run can win the unique invoice constraint. Retry each
        // subscription as a complete transaction so no invoice is left without
        // its lines, redemptions, or advanced billing date.
        for (const row of todo) {
          const invoice = invoices.find((inv) => inv.subscriptionId === row.subscription.id)!;
          const rowLines = lines.filter((line) => line.invoiceId === invoice.id);
          const rowRedemptions = redemptionRows.filter((redemption) => redemption.invoiceId === invoice.id);
          try {
            await prisma.$transaction(async (tx) => {
              await tx.invoice.create({ data: invoice });
              if (rowLines.length > 0) await tx.invoiceLine.createMany({ data: rowLines });
              if (rowRedemptions.length > 0) {
                await tx.discountRedemption.createMany({ data: rowRedemptions });
                const counts = new Map<string, number>();
                for (const redemption of rowRedemptions) {
                  counts.set(redemption.discountId, (counts.get(redemption.discountId) ?? 0) + 1);
                }
                for (const [discountId, count] of counts) {
                  await tx.discount.update({
                    where: { id: discountId },
                    data: { usedCount: { increment: count } },
                  });
                }
              }
              const nextPeriodEnd = periodEnd(
                row.endIso,
                row.subscription.plan.billingPeriod,
                row.subscription.plan.intervalCount,
              );
              await tx.$executeRaw`
                UPDATE subscriptions
                   SET next_billing_date = ${row.endIso}::date,
                       period_start = ${row.endIso}::date,
                       period_end = ${nextPeriodEnd}::date,
                       updated_at = now()
                 WHERE id = ${row.subscription.id}::uuid`;
            });

            for (const applied of row.doc.appliedDiscounts) {
              const key = `${applied.discountId}:${row.subscription.customerId}`;
              runUse.set(key, (runUse.get(key) ?? 0) + 1);
              runTotal.set(applied.discountId, (runTotal.get(applied.discountId) ?? 0) + 1);
              persistedCounts.set(applied.discountId, (persistedCounts.get(applied.discountId) ?? 0) + 1);
            }
            result.created += 1;
          } catch (inner) {
            if (
              inner instanceof Prisma.PrismaClientKnownRequestError &&
              inner.code === "P2002"
            ) {
              result.skipped += 1;
            } else {
              result.errors.push({
                subscriptionId: row.subscription.id,
                message: inner instanceof Error ? inner.message : "unknown error",
              });
            }
          }
        }
      } else {
        result.errors.push({
          subscriptionId: "batch",
          message: error instanceof Error ? error.message : "unknown error",
        });
      }
    }

    // processed rows have moved past the due date, so the next query returns
    // the following batch; if nothing moved, stop rather than spin
    if (!options.dryRun && result.created + result.skipped === progressBefore) break;
  }

  result.durationMs = Date.now() - startedAt;

  try {
    await prisma.billingRun.create({
      data: {
        asOf: new Date(`${asOfInput}T00:00:00Z`),
        dryRun: options.dryRun,
        considered: result.considered,
        created: result.created,
        skipped: result.skipped,
        errorCount: result.errors.length,
        totalValue: result.totalValue,
        durationMs: result.durationMs,
        triggeredBy: options.triggeredBy ?? "ui",
      },
    });
  } catch (error) {
    console.error("[billing] could not write the run log", error);
  }

  return result;
}

/**
 * Confirm every draft invoice: assigns the next gap-free number from the
 * counter table. A Postgres sequence would leave gaps on any rollback, so the
 * counter row is incremented atomically instead.
 */
export async function confirmDraftInvoices(limit = 1000): Promise<number> {
  const drafts = await prisma.invoice.findMany({
    where: { status: InvoiceStatus.draft },
    orderBy: { invoiceDate: "asc" },
    take: limit,
    select: { id: true },
  });
  if (drafts.length === 0) return 0;

  // the counter and the invoices move together: if the update fails, the
  // numbers must not be burned
  await prisma.$transaction(async (tx) => {
    const counter = await tx.counter.upsert({
      where: { key: "INV-2026" },
      create: { key: "INV-2026", lastNo: drafts.length },
      update: { lastNo: { increment: drafts.length } },
    });

    const start = counter.lastNo - drafts.length + 1;
    const values = Prisma.join(
      drafts.map(
        (draft, index) =>
          Prisma.sql`(${draft.id}::uuid, ${`INV-2026-${String(start + index).padStart(5, "0")}`})`,
      ),
    );

    await tx.$executeRaw`
      UPDATE invoices AS i
         SET status = 'confirmed', number = v.number
        FROM (VALUES ${values}) AS v(id, number)
       WHERE i.id = v.id AND i.number IS NULL`;
  });

  return drafts.length;
}
