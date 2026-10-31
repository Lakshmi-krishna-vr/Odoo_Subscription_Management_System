import { randomUUID } from "node:crypto";
import type { Plan, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { priceDocument } from "@/core/pricing";
import { advance } from "@/core/periods";
import { checkTransition } from "@/core/state";
import type { PlanPolicy, SubEvent, SubStatus } from "@/contracts";

export interface CreateSubscriptionInput {
  customerId: string;
  templateId: string;
  startDate: string; // YYYY-MM-DD
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function policyOf(plan: Plan): PlanPolicy {
  return {
    pausable: plan.pausable,
    renewable: plan.renewable,
    closable: plan.closable,
    autoClose: plan.autoClose,
  };
}

/**
 * Gap-free document numbers, in the same counter table the invoice numbers use.
 * A Postgres sequence leaves gaps on rollback; this does not.
 */
async function nextNumber(tx: Prisma.TransactionClient, key: string, pad = 5): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, lastNo: 1 },
    update: { lastNo: { increment: 1 } },
  });
  return `${key}-${String(counter.lastNo).padStart(pad, "0")}`;
}

/**
 * Build a subscription from a quotation template: the template supplies the plan
 * and the lines, the plan supplies the billing period, and the engine prices it
 * — so the quote, the subscription and the first invoice all show one number.
 *
 * It is created as a draft; nothing is billed until it is activated.
 */
export async function createSubscriptionFromTemplate(input: CreateSubscriptionInput) {
  const template = await prisma.quotationTemplate.findUnique({
    where: { id: input.templateId },
    include: { plan: true, lines: true },
  });
  if (!template || !template.isActive) throw new Error("Quotation template not found.");
  if (template.lines.length === 0) throw new Error("That template has no product lines.");

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new Error("Customer not found.");

  const productIds = template.lines.map((line) => line.productId);
  const [products, taxes, discounts] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } } }),
    prisma.tax.findMany(),
    prisma.discount.findMany({ where: { isActive: true } }),
  ]);

  const productById = new Map(products.map((product) => [product.id, product]));

  const lines = template.lines.map((line) => {
    const product = productById.get(line.productId);
    if (!product) throw new Error("A template line points at a missing product.");
    return {
      product: {
        id: product.id,
        name: product.name,
        salesPrice: product.salesPrice,
        taxId: product.taxId,
      },
      quantity: line.quantity,
    };
  });

  const startIso = input.startDate;
  const doc = priceDocument({
    lines,
    taxes: taxes.map((tax) => ({ id: tax.id, name: tax.name, rateBp: tax.rateBp })),
    discounts: discounts.map((discount) => ({
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
    })),
    asOf: startIso,
  });

  const periodEndIso = advance(
    startIso,
    template.plan.billingPeriod,
    template.plan.intervalCount,
    Number(startIso.slice(8, 10)),
  );

  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, "SUB-2026");

    const subscription = await tx.subscription.create({
      data: {
        id: randomUUID(),
        number,
        customerId: customer.id,
        planId: template.planId,
        templateId: template.id,
        status: "draft",
        startDate: new Date(`${startIso}T00:00:00Z`),
        expiryDate:
          template.plan.billingPeriod === "year"
            ? new Date(`${periodEndIso}T00:00:00Z`)
            : null,
        nextBillingDate: new Date(`${startIso}T00:00:00Z`),
        periodStart: new Date(`${startIso}T00:00:00Z`),
        periodEnd: new Date(`${periodEndIso}T00:00:00Z`),
        paymentTermsDays: customer.paymentTermsDays,
        lines: {
          create: doc.lines.map((line, index) => ({
            id: randomUUID(),
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxId: productById.get(template.lines[index].productId)?.taxId ?? null,
          })),
        },
      },
    });

    return { subscription, total: doc.total };
  });
}

export interface TransitionResult {
  status: SubStatus;
  message: string;
}

/**
 * Move a subscription along its lifecycle. The transition table and the plan's
 * switches decide what is allowed — the UI only offers the buttons.
 */
export async function transitionSubscription(
  subscriptionId: string,
  event: SubEvent,
): Promise<TransitionResult> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!subscription) throw new Error("Subscription not found.");

  const check = checkTransition({
    from: subscription.status,
    event,
    plan: policyOf(subscription.plan),
  });
  if (!check.ok || !check.next) throw new Error(check.reason ?? "That move is not allowed.");

  const data: Prisma.SubscriptionUpdateInput = { status: check.next };

  // activating sets the first billing period; a subscription that starts in the
  // future stays dormant until its start date arrives
  if (check.next === "active") {
    const startIso = isoDate(subscription.startDate);
    const endIso = advance(
      startIso,
      subscription.plan.billingPeriod,
      subscription.plan.intervalCount,
      Number(startIso.slice(8, 10)),
    );
    data.periodStart = new Date(`${startIso}T00:00:00Z`);
    data.periodEnd = new Date(`${endIso}T00:00:00Z`);
    data.nextBillingDate = new Date(`${startIso}T00:00:00Z`);
  }

  if (check.next === "paused") data.pausedAt = new Date();

  await prisma.subscription.update({ where: { id: subscription.id }, data });

  return {
    status: check.next,
    message: `Subscription ${subscription.number} is now ${check.next}.`,
  };
}
