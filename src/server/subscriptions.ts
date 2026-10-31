import { randomUUID } from "node:crypto";
import type { Plan, Prisma, SubscriptionLine } from "@prisma/client";
import { prisma } from "@/server/db";
import { priceDocument } from "@/core/pricing";
import { addDays, advance, daysBetween, periodEnd, todayIso } from "@/core/periods";
import { SUB_TRANSITIONS, checkTransition } from "@/core/state";
import type {
  DiscountRule,
  PlanPolicy,
  PricedDoc,
  PriceLineInput,
  SubEvent,
  SubStatus,
  TaxRule,
} from "@/contracts";

export const SUBSCRIPTION_EVENTS = Object.keys(SUB_TRANSITIONS) as SubEvent[];

const SUBSCRIPTION_COUNTER_KEY = "SUB-2026";

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

function asSentence(reason: string): string {
  const sentence = reason.charAt(0).toUpperCase() + reason.slice(1);
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

export function quotationValidUntil(createdAt: Date, validityDays: number): string {
  return addDays(todayIso("Asia/Kolkata", createdAt), validityDays);
}

export function allowedEvents(status: SubStatus, plan: PlanPolicy): SubEvent[] {
  return SUBSCRIPTION_EVENTS.filter(
    (event) => checkTransition({ from: status, event, plan }).ok,
  );
}

export async function changeSubscriptionStatus(
  subscriptionId: string,
  event: SubEvent,
  details: { reason?: string },
): Promise<{ status: SubStatus }> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, lines: true },
  });
  if (!subscription) throw new Error("Subscription not found.");

  const { plan } = subscription;
  const transition = checkTransition({ from: subscription.status, event, plan });
  if (!transition.ok || !transition.next) {
    throw new Error(asSentence(transition.reason ?? "That change is not allowed"));
  }

  const startIso = isoDate(subscription.startDate);
  const changes: Prisma.SubscriptionUpdateManyMutationInput = { status: transition.next };
  const guard: Prisma.SubscriptionWhereInput = { id: subscriptionId, status: subscription.status };

  if (event === "confirm") {
    const template = subscription.templateId
      ? await prisma.quotationTemplate.findUnique({ where: { id: subscription.templateId } })
      : null;
    if (template && quotationValidUntil(subscription.createdAt, template.validityDays) < todayIso()) {
      throw new Error("This quotation has expired.");
    }
    if (subscription.lines.length === 0) {
      throw new Error("Add at least one line before confirming.");
    }
    const totalQuantity = subscription.lines.reduce((sum, line) => sum + line.quantity, 0);
    if (totalQuantity < plan.minQuantity) {
      throw new Error(`This plan needs at least ${plan.minQuantity} units.`);
    }
    if (plan.availableFrom && startIso < isoDate(plan.availableFrom)) {
      throw new Error(`This plan is only available from ${isoDate(plan.availableFrom)}.`);
    }
    if (plan.availableTo && startIso > isoDate(plan.availableTo)) {
      throw new Error(`This plan was only available until ${isoDate(plan.availableTo)}.`);
    }
  }

  if (event === "activate" && startIso > todayIso()) {
    throw new Error("This subscription starts in the future. Activate it on or after its start date.");
  }

  if (event === "pause") changes.pausedAt = new Date();

  if (event === "resume") {
    const pausedDays = subscription.pausedAt
      ? Math.max(0, daysBetween(todayIso("Asia/Kolkata", subscription.pausedAt), todayIso()))
      : 0;
    changes.nextBillingDate = toDate(addDays(isoDate(subscription.nextBillingDate), pausedDays));
    changes.periodStart = toDate(addDays(isoDate(subscription.periodStart), pausedDays));
    changes.periodEnd = toDate(addDays(isoDate(subscription.periodEnd), pausedDays));
    changes.pausedAt = null;
  }

  if (event === "renew") {
    if (!subscription.expiryDate) {
      throw new Error("Open-ended subscriptions do not need renewal.");
    }
    changes.expiryDate = toDate(
      advance(isoDate(subscription.expiryDate), plan.billingPeriod, plan.intervalCount),
    );
    guard.expiryDate = subscription.expiryDate;
  }

  if (event === "close") {
    const reason = (details.reason ?? "").trim();
    if (!reason) throw new Error("Give a reason for closing the subscription.");
    changes.closedReason = reason;
  }

  const changeResult = await prisma.subscription.updateMany({ where: guard, data: changes });
  if (changeResult.count === 0) {
    throw new Error("That subscription changed while you were looking. Reload and retry.");
  }

  return { status: transition.next };
}

export async function previewNextInvoice(subscription: {
  customerId: string;
  nextBillingDate: Date;
  lines: SubscriptionLine[];
}): Promise<PricedDoc> {
  const [taxes, discounts, redemptions, products] = await Promise.all([
    prisma.tax.findMany(),
    prisma.discount.findMany({ where: { isActive: true } }),
    prisma.discountRedemption.groupBy({
      by: ["discountId"],
      where: { customerId: subscription.customerId },
      _count: { _all: true },
    }),
    prisma.product.findMany({
      where: { id: { in: subscription.lines.map((line) => line.productId) } },
      select: { id: true, name: true },
    }),
  ]);

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

  const customerRedemptions: Record<string, number> = {};
  for (const rule of discountRules) customerRedemptions[rule.id] = 0;
  for (const row of redemptions) customerRedemptions[row.discountId] = row._count._all;

  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const lines: PriceLineInput[] = subscription.lines.map((line) => ({
    product: {
      id: line.productId,
      name: productNames.get(line.productId) ?? "Subscription charge",
      salesPrice: line.unitPrice,
      taxId: line.taxId,
    },
    quantity: line.quantity,
  }));

  return priceDocument({
    lines,
    taxes: taxRules,
    discounts: discountRules,
    customerRedemptions,
    asOf: isoDate(subscription.nextBillingDate),
  });
}

export async function startSubscriptionFromTemplate(details: {
  customerId: string;
  templateId: string;
  startDate: string;
  expiryDate: string | null;
}): Promise<{ id: string; number: string }> {
  if (details.expiryDate && details.expiryDate <= details.startDate) {
    throw new Error("The expiry date must be after the start date.");
  }

  // The reads happen before the transaction: they are read-only, and running
  // them inside an interactive transaction over a remote database blows the
  // 5-second default (Prisma P2028). Only the two writes are transactional.
  const [customer, template] = await Promise.all([
    prisma.customer.findFirst({ where: { id: details.customerId, isActive: true } }),
    prisma.quotationTemplate.findFirst({
      where: { id: details.templateId, isActive: true },
      include: { plan: true, lines: true },
    }),
  ]);
    if (!customer) throw new Error("Choose an active customer.");
    if (!template) throw new Error("Choose an active quotation template.");
    if (template.lines.length === 0) throw new Error("This template has no lines.");

  const variantIds = template.lines
    .map((line) => line.variantId)
    .filter((variantId): variantId is string => variantId !== null);
  const [products, variants] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: template.lines.map((line) => line.productId) } },
      select: { id: true, salesPrice: true, taxId: true },
    }),
    prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, extraPrice: true },
    }),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const extraPriceByVariant = new Map(variants.map((variant) => [variant.id, variant.extraPrice]));

  const subscriptionLines = template.lines.map((line, lineIndex) => {
    const product = productById.get(line.productId);
    if (!product) throw new Error("A product on this template no longer exists.");
    const basePrice = lineIndex === 0 ? template.plan.price : product.salesPrice;
    const extraPrice = line.variantId ? (extraPriceByVariant.get(line.variantId) ?? 0) : 0;
    return {
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: basePrice + extraPrice,
      taxId: product.taxId,
    };
  });

  return prisma.$transaction(
    async (tx) => {
      const counter = await tx.counter.upsert({
        where: { key: SUBSCRIPTION_COUNTER_KEY },
        create: { key: SUBSCRIPTION_COUNTER_KEY, lastNo: 1 },
        update: { lastNo: { increment: 1 } },
      });
      const subscriptionNumber = `${SUBSCRIPTION_COUNTER_KEY}-${String(counter.lastNo).padStart(5, "0")}`;

      const firstPeriodEnd = periodEnd(
        details.startDate,
        template.plan.billingPeriod,
        template.plan.intervalCount,
        toDate(details.startDate).getUTCDate(),
      );

      const subscription = await tx.subscription.create({
        data: {
          number: subscriptionNumber,
          customerId: customer.id,
          planId: template.planId,
          templateId: template.id,
          status: "draft",
          startDate: toDate(details.startDate),
          expiryDate: details.expiryDate ? toDate(details.expiryDate) : null,
          nextBillingDate: toDate(details.startDate),
          periodStart: toDate(details.startDate),
          periodEnd: toDate(firstPeriodEnd),
          paymentTermsDays: customer.paymentTermsDays,
          lines: { create: subscriptionLines },
        },
        select: { id: true, number: true },
      });

      return subscription;
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}
