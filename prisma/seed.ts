/**
 * Demo data for the subscription system.
 *
 * Deterministic: the same run always produces the same numbers, and the demo
 * date is fixed at 2026-10-31 so "billing day" always has work to do.
 *
 *   npm run db:seed
 */
import {
  PrismaClient,
  Role,
  SubStatus,
  InvoiceStatus,
  PlanPeriod,
  PaymentMethod,
  DiscountType,
  DiscountScope,
} from "@prisma/client";
import { hashSync } from "bcryptjs";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

const TODAY = new Date("2026-10-31T00:00:00Z");
const DAY = 86_400_000;

const date = (iso: string) => new Date(`${iso}T00:00:00Z`);
const addDays = (base: Date, days: number) => new Date(base.getTime() + days * DAY);

/** deterministic pseudo-random so every seed run produces the same demo */
let state = 20261031;
function rnd(): number {
  state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
  return state / 2_147_483_648;
}
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)];

const DEMO_PASSWORD = "Brightloop#2026";

const COMPANIES = [
  ["Acme Retail", "Kochi", "Riya Menon"],
  ["Northwind Traders", "Bengaluru", "Arun Kumar"],
  ["Blue Harbour Logistics", "Kollam", "Deepa Nair"],
  ["Vertex Manufacturing", "Coimbatore", "Suresh Babu"],
  ["Cedar & Co", "Thrissur", "Anita Joseph"],
  ["Meridian Health", "Chennai", "Vikram Rao"],
  ["Orbit Media", "Kottayam", "Meera Krishnan"],
  ["Sunrise Foods", "Kozhikode", "Faisal Ahmed"],
  ["Granite Works", "Mysuru", "Latha Shetty"],
  ["Harbour Freight", "Mangaluru", "Joseph Thomas"],
];

const FIRST = ["Anu", "Rahul", "Sneha", "Arjun", "Divya", "Nikhil", "Priya", "Vivek", "Kavya", "Rohit"];
const LAST = ["Nair", "Menon", "Pillai", "Sharma", "Iyer", "George", "Reddy", "Kurup", "Das", "Varma"];

async function main() {
  console.log("clearing existing data…");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE payments, discount_redemptions, invoice_lines, invoices,
       subscription_lines, subscriptions, quotation_template_lines,
       quotation_templates, discounts, plans, product_variants, products,
       taxes, password_resets, users, customers, counters
     RESTART IDENTITY CASCADE`,
  );

  const passwordHash = hashSync(DEMO_PASSWORD, 10);

  // ── tax ────────────────────────────────────────────────────────────────
  const gst = await prisma.tax.create({
    data: { id: randomUUID(), name: "GST 18%", rateBp: 1800 },
  });

  // ── products + variants ────────────────────────────────────────────────
  const productSpecs = [
    { name: "Brightloop ERP", type: "software", salesPrice: 100_000, costPrice: 30_000 },
    { name: "Brightloop CRM", type: "software", salesPrice: 75_000, costPrice: 20_000 },
    { name: "Brightloop Analytics", type: "software", salesPrice: 120_000, costPrice: 40_000 },
    { name: "Backup add-on", type: "add-on", salesPrice: 20_000, costPrice: 5_000, isAddon: true },
    { name: "Priority support", type: "add-on", salesPrice: 35_000, costPrice: 12_000, isAddon: true },
    { name: "Onboarding service", type: "service", salesPrice: 500_000, costPrice: 150_000 },
  ];

  const products = [];
  for (const spec of productSpecs) {
    products.push(
      await prisma.product.create({
        data: {
          id: randomUUID(),
          name: spec.name,
          type: spec.type,
          salesPrice: spec.salesPrice,
          costPrice: spec.costPrice,
          isAddon: spec.isAddon ?? false,
          taxId: gst.id,
          notes: `${spec.name} sold on subscription.`,
        },
      }),
    );
  }
  const [erp, crm, analytics, backup, support, onboarding] = products;

  // the brief's example: choosing the Odoo brand adds 560
  await prisma.productVariant.createMany({
    data: [
      { id: randomUUID(), productId: erp.id, attribute: "Brand", value: "Odoo", extraPrice: 56_000 },
      { id: randomUUID(), productId: erp.id, attribute: "Brand", value: "Standard", extraPrice: 0 },
      { id: randomUUID(), productId: crm.id, attribute: "Brand", value: "Odoo", extraPrice: 56_000 },
      { id: randomUUID(), productId: analytics.id, attribute: "Tier", value: "Growth", extraPrice: 30_000 },
    ],
  });

  // ── plans ──────────────────────────────────────────────────────────────
  const planSpecs = [
    { name: "ERP Monthly", price: 100_000, billingPeriod: PlanPeriod.month, minQuantity: 1 },
    { name: "ERP Yearly", price: 1_000_000, billingPeriod: PlanPeriod.year, minQuantity: 1 },
    { name: "Starter Weekly", price: 25_000, billingPeriod: PlanPeriod.week, minQuantity: 1 },
    { name: "Trial Daily", price: 5_000, billingPeriod: PlanPeriod.day, minQuantity: 1, autoClose: true },
    {
      name: "Enterprise Yearly",
      price: 2_000_000,
      billingPeriod: PlanPeriod.year,
      minQuantity: 10,
      autoClose: true,
      closable: false,
      pausable: false,
    },
  ];

  const plans = [];
  for (const spec of planSpecs) {
    plans.push(
      await prisma.plan.create({
        data: {
          id: randomUUID(),
          name: spec.name,
          price: spec.price,
          billingPeriod: spec.billingPeriod,
          minQuantity: spec.minQuantity,
          autoClose: spec.autoClose ?? false,
          closable: spec.closable ?? true,
          pausable: spec.pausable ?? true,
          renewable: true,
          availableFrom: date("2026-01-01"),
          availableTo: null,
        },
      }),
    );
  }
  const [erpMonthly, erpYearly, weekly, daily, enterprise] = plans;

  // ── discounts ──────────────────────────────────────────────────────────
  await prisma.discount.createMany({
    data: [
      {
        id: randomUUID(),
        name: "10% volume",
        type: DiscountType.percent,
        value: 1000,
        scope: DiscountScope.products,
        productIds: [erp.id],
        minQuantity: 5,
        startsAt: date("2026-01-01"),
        endsAt: date("2027-12-31"),
      },
      {
        id: randomUUID(),
        name: "Festive ₹500 off",
        type: DiscountType.fixed,
        value: 50_000,
        scope: DiscountScope.subscription,
        productIds: [],
        minPurchase: 100_000,
        startsAt: date("2026-10-01"),
        endsAt: date("2026-11-15"),
      },
      {
        id: randomUUID(),
        name: "Launch offer",
        code: "LAUNCH20",
        type: DiscountType.percent,
        value: 2000,
        scope: DiscountScope.subscription,
        productIds: [],
        usageLimit: 5,
        perCustomerLimit: 1,
        startsAt: date("2026-09-01"),
        endsAt: date("2026-12-31"),
      },
    ],
  });

  // ── quotation template ─────────────────────────────────────────────────
  const template = await prisma.quotationTemplate.create({
    data: {
      id: randomUUID(),
      name: "Standard ERP offer",
      planId: erpMonthly.id,
      validityDays: 30,
      lines: {
        create: [
          { id: randomUUID(), productId: erp.id, quantity: 1 },
          { id: randomUUID(), productId: backup.id, quantity: 1 },
        ],
      },
    },
  });

  // ── customers ──────────────────────────────────────────────────────────
  const customers = [];
  for (let i = 0; i < 60; i++) {
    const [company, city, contact] = COMPANIES[i % COMPANIES.length];
    const suffix = i < COMPANIES.length ? "" : ` ${Math.floor(i / COMPANIES.length) + 1}`;
    customers.push({
      id: randomUUID(),
      code: `CUS-${String(i + 1).padStart(4, "0")}`,
      companyName: `${company}${suffix}`,
      contactName: i < COMPANIES.length ? contact : `${pick(FIRST)} ${pick(LAST)}`,
      email: `billing${i + 1}@${company.toLowerCase().replace(/[^a-z]/g, "")}.example`,
      phone: `+91 9${int(100000000, 999999999)}`,
      address: `${int(1, 200)}, ${city}`,
      paymentTermsDays: pick([0, 7, 15, 30]),
    });
  }
  await prisma.customer.createMany({ data: customers });

  // ── users ──────────────────────────────────────────────────────────────
  const acme = customers[0];
  await prisma.user.createMany({
    data: [
      { id: randomUUID(), email: "admin@brightloop.test", passwordHash, name: "Admin", role: Role.admin },
      { id: randomUUID(), email: "staff@brightloop.test", passwordHash, name: "Ops Staff", role: Role.staff },
      {
        id: randomUUID(),
        email: "customer@brightloop.test",
        passwordHash,
        name: "Acme Retail",
        role: Role.customer,
        customerId: acme.id,
      },
    ],
  });

  // ── subscriptions + lines ──────────────────────────────────────────────
  const subscriptions: {
    id: string;
    number: string;
    customerId: string;
    planId: string;
    status: SubStatus;
    startDate: Date;
    expiryDate: Date | null;
    nextBillingDate: Date;
    periodStart: Date;
    periodEnd: Date;
    paymentTermsDays: number;
    templateId: string | null;
  }[] = [];
  const subLines: {
    id: string;
    subscriptionId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    taxId: string;
  }[] = [];

  const planChoices = [erpMonthly, erpYearly, weekly, daily, enterprise];

  for (let i = 0; i < 1200; i++) {
    const customer = customers[i % customers.length];
    const plan = i < 400 ? erpMonthly : pick(planChoices);
    const id = randomUUID();

    let status: SubStatus;
    let nextBillingDate: Date;
    let startDate: Date;

    if (i < 400) {
      // due today — this is what the billing run will invoice
      status = SubStatus.active;
      startDate = addDays(TODAY, -30 * int(1, 6));
      nextBillingDate = TODAY;
    } else if (i < 900) {
      status = SubStatus.active;
      startDate = addDays(TODAY, -int(1, 200));
      nextBillingDate = addDays(TODAY, int(1, 28));
    } else if (i < 1000) {
      status = SubStatus.confirmed;
      startDate = addDays(TODAY, int(1, 20));
      nextBillingDate = startDate;
    } else if (i < 1060) {
      status = SubStatus.paused;
      startDate = addDays(TODAY, -int(30, 200));
      nextBillingDate = addDays(TODAY, int(5, 40));
    } else if (i < 1160) {
      status = SubStatus.closed;
      startDate = addDays(TODAY, -int(200, 500));
      nextBillingDate = startDate;
    } else {
      status = SubStatus.draft;
      startDate = TODAY;
      nextBillingDate = TODAY;
    }

    subscriptions.push({
      id,
      number: `SUB-2026-${String(i + 1).padStart(5, "0")}`,
      customerId: customer.id,
      planId: plan.id,
      status,
      startDate,
      expiryDate: plan.billingPeriod === PlanPeriod.year ? addDays(startDate, 365) : null,
      nextBillingDate,
      periodStart: nextBillingDate,
      periodEnd: addDays(nextBillingDate, plan.billingPeriod === PlanPeriod.year ? 365 : 30),
      paymentTermsDays: customer.paymentTermsDays,
      templateId: i === 0 ? template.id : null,
    });

    const lineCount = rnd() > 0.7 ? 2 : 1;
    for (let l = 0; l < lineCount; l++) {
      const product = l === 0 ? (plan === enterprise ? analytics : erp) : pick([backup, support]);
      subLines.push({
        id: randomUUID(),
        subscriptionId: id,
        productId: product.id,
        quantity: plan === enterprise ? 10 : 1,
        unitPrice: l === 0 ? plan.price : product.salesPrice,
        taxId: gst.id,
      });
    }
  }

  console.log(`inserting ${subscriptions.length} subscriptions…`);
  for (let i = 0; i < subscriptions.length; i += 300) {
    await prisma.subscription.createMany({ data: subscriptions.slice(i, i + 300) });
  }
  for (let i = 0; i < subLines.length; i += 500) {
    await prisma.subscriptionLine.createMany({ data: subLines.slice(i, i + 500) });
  }

  // ── invoices + lines + payments (history for the finance view) ─────────
  const invoices: {
    id: string;
    number: string;
    subscriptionId: string;
    customerId: string;
    periodStart: Date;
    periodEnd: Date;
    invoiceDate: Date;
    dueDate: Date;
    status: InvoiceStatus;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    total: number;
    amountPaid: number;
  }[] = [];
  const invoiceLines: {
    id: string;
    invoiceId: string;
    productId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    taxableAmount: number;
    taxRateBp: number;
    taxAmount: number;
    lineTotal: number;
  }[] = [];
  const payments: {
    id: string;
    invoiceId: string;
    customerId: string;
    method: PaymentMethod;
    amount: number;
    paidAt: Date;
    note: string;
  }[] = [];

  let invoiceNo = 0;
  for (const sub of subscriptions) {
    if (sub.status !== SubStatus.active && sub.status !== SubStatus.closed) continue;

    const periods = sub.status === SubStatus.closed ? int(2, 4) : 2;
    for (let p = periods; p >= 1; p--) {
      const invoiceDate = addDays(sub.nextBillingDate, -30 * p);
      const line = subLines.find((l) => l.subscriptionId === sub.id);
      if (!line) continue;

      const gross = line.unitPrice * line.quantity;
      const taxAmount = Math.round(gross * 0.18);
      const total = gross + taxAmount;

      const roll = rnd();
      let status: InvoiceStatus;
      let amountPaid = 0;
      if (roll < 0.6) {
        status = InvoiceStatus.paid;
        amountPaid = total;
      } else if (roll < 0.78) {
        status = InvoiceStatus.confirmed;
      } else if (roll < 0.9) {
        status = InvoiceStatus.overdue;
      } else {
        status = InvoiceStatus.partially_paid;
        amountPaid = Math.round(total / 2);
      }

      const invoiceId = randomUUID();
      invoiceNo += 1;

      invoices.push({
        id: invoiceId,
        number: `INV-2026-${String(invoiceNo).padStart(5, "0")}`,
        subscriptionId: sub.id,
        customerId: sub.customerId,
        periodStart: invoiceDate,
        periodEnd: addDays(invoiceDate, 30),
        invoiceDate,
        dueDate: addDays(invoiceDate, sub.paymentTermsDays),
        status,
        subtotal: gross,
        discountTotal: 0,
        taxTotal: taxAmount,
        total,
        amountPaid,
      });

      invoiceLines.push({
        id: randomUUID(),
        invoiceId,
        productId: line.productId,
        description: "Subscription charge",
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: 0,
        taxableAmount: gross,
        taxRateBp: 1800,
        taxAmount,
        lineTotal: total,
      });

      if (amountPaid > 0) {
        payments.push({
          id: randomUUID(),
          invoiceId,
          customerId: sub.customerId,
          method: pick([
            PaymentMethod.bank,
            PaymentMethod.upi,
            PaymentMethod.cash,
            PaymentMethod.cheque,
            PaymentMethod.online,
          ]),
          amount: amountPaid,
          paidAt: addDays(invoiceDate, int(1, 20)),
          note: "Recorded from bank statement",
        });
      }
    }
  }

  console.log(`inserting ${invoices.length} invoices…`);
  for (let i = 0; i < invoices.length; i += 300) {
    await prisma.invoice.createMany({ data: invoices.slice(i, i + 300) });
  }
  for (let i = 0; i < invoiceLines.length; i += 500) {
    await prisma.invoiceLine.createMany({ data: invoiceLines.slice(i, i + 500) });
  }
  for (let i = 0; i < payments.length; i += 500) {
    await prisma.payment.createMany({ data: payments.slice(i, i + 500) });
  }

  // ── document counters ──────────────────────────────────────────────────
  await prisma.counter.createMany({
    data: [
      { key: "SUB-2026", lastNo: subscriptions.length },
      { key: "INV-2026", lastNo: invoices.length },
    ],
  });

  const counts = {
    customers: await prisma.customer.count(),
    products: await prisma.product.count(),
    plans: await prisma.plan.count(),
    subscriptions: await prisma.subscription.count(),
    dueToday: await prisma.subscription.count({
      where: { status: SubStatus.active, nextBillingDate: { lte: TODAY } },
    }),
    invoices: await prisma.invoice.count(),
    payments: await prisma.payment.count(),
    users: await prisma.user.count(),
  };
  console.log("seeded:", counts);
  console.log(`demo logins: admin@brightloop.test / staff@brightloop.test / customer@brightloop.test`);
  console.log(`password: ${DEMO_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
