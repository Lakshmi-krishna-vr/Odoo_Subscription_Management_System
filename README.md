# Brightloop Subscription Management

**Live demo:** <https://oddoo.vercel.app/>

A subscription management system that replaces the spreadsheet Brightloop Software runs its billing
month on. It holds the catalogue of products and plans, quotes a customer, tracks a subscription
through its life, raises the invoice on billing day, applies the discounts and taxes, records the
payment when it arrives, and shows the finance lead what was invoiced, what was collected and what is
overdue. There are three surfaces — an admin console for configuration, a staff workspace for daily
operations, and a customer portal where a customer sees only their own subscriptions and invoices.

## What it does

**Admin console** — `/admin`

- Products with variants; a variant carries an extra price (a brand variant adds to the list price).
- Plans billed daily, weekly, monthly or yearly, with an interval count, a minimum quantity, an
  availability window, and per-plan switches for early close, pause and renewal.
- Discount rules: fixed amount or percentage, scoped to specific products or to the whole
  subscription, with a date window, a minimum purchase or quantity, a total usage limit and a
  per-customer limit.
- Staff accounts, so access is granted from inside the system rather than in the database.

**Staff workspace** — `/staff`

- Customers with contacts, payment terms and what each still owes.
- Subscriptions started from a quotation template and moved through
  Draft → Quotation → Confirmed → Active → Paused → Closed, with the plan's policy deciding which
  moves are allowed.
- A quotation view showing the priced offer, its validity date and what will be billed next.
- Invoices that can be confirmed (which assigns the number), sent, printed and cancelled.
- Payments recorded against an invoice by method, amount, date and note; the invoice status follows
  the money.
- A billing run that previews what is due, then creates the invoices in one go.
- A finance view for a chosen month: invoiced, collected, outstanding, overdue count, collections by
  method and the largest overdue accounts.

**Customer portal** — `/portal`

- The customer's own subscriptions with plan, status and next billing date.
- Their invoices, and a printable invoice detail page.
- Only their own data: every portal query filters on the customer id from the session, and draft
  invoices are hidden until they are confirmed.

## Screenshots

<!-- Add screenshots under docs/screenshots/ at the widths noted. Keep them PNG, full browser
     viewport, no browser chrome, and use the seeded demo data so the numbers are consistent. -->

<!-- 1. Admin — plans list, 1440×900
     ![Plans](docs/screenshots/admin-plans.png) -->

<!-- 2. Staff — billing run with a dry-run preview open, 1440×900
     ![Billing run](docs/screenshots/staff-billing.png) -->

<!-- 3. Staff — invoice detail with a payment recorded, 1440×900
     ![Invoice](docs/screenshots/staff-invoice.png) -->

<!-- 4. Staff — finance view for October 2026, 1440×900
     ![Finance](docs/screenshots/staff-finance.png) -->

<!-- 5. Customer portal — invoice list, 1280×800
     ![Portal](docs/screenshots/portal-invoices.png) -->

<!-- 6. Login, 1280×800
     ![Login](docs/screenshots/login.png) -->

## Quick start

Requires Node 20 or newer and a PostgreSQL 14+ database (the demo was developed against Neon).

```bash
git clone <repository-url> brightloop-subscriptions
cd brightloop-subscriptions
npm install                      # also runs prisma generate
cp .env.example .env
```

Fill in `.env`:

```ini
DATABASE_URL="postgresql://user:***@host:5432/subscriptions?sslmode=require"
AUTH_SECRET="a-long-random-string"   # signs the session cookie; 16 characters minimum
JOB_SECRET="another-random-string"   # only needed for the scheduled billing endpoint
```

Then create the schema, load the demo data and start the app:

```bash
npx prisma db push     # creates the tables from prisma/schema.prisma
npm run db:seed        # 60 customers, 1,200 subscriptions, 2,100 invoices
npm run dev            # http://localhost:3000
```

Demo logins, all with the password `Brightloop#2026`:

| Email | Role | Lands on |
| --- | --- | --- |
| `admin@brightloop.test` | admin | `/admin` |
| `staff@brightloop.test` | staff | `/staff` |
| `customer@brightloop.test` | customer | `/portal` (Acme Retail) |

## Routes

Twenty-eight pages and one API endpoint. Access is enforced on the server by the route-group layout,
so typing a URL into the address bar is refused, not just hidden.

| Route | What it does | Access |
| --- | --- | --- |
| `/` | Choose the admin, staff or customer workspace to continue. | public |
| `/login` | Sign in to reach your role's workspace. | public |
| `/register` | Create a customer account to start using the portal. | public |
| `/forgot` | Request a password reset for your account. | public |
| `/reset/[token]` | Set a new password using your reset link. | public, single use |
| `/admin` | Overview of the catalogue and links to every admin screen. | admin |
| `/admin/products` | Browse the product catalogue. | admin |
| `/admin/products/new` | Add a product, with variants. | admin |
| `/admin/plans` | Review subscription plans and their policies. | admin |
| `/admin/plans/new` | Create a plan with its price, billing cycle and policy switches. | admin |
| `/admin/discounts` | Review active and past discount offers. | admin |
| `/admin/discounts/new` | Create a discount and define its eligibility rules. | admin |
| `/admin/staff` | Create, deactivate and reactivate staff accounts. | admin |
| `/staff` | Workspace hub: customers, subscriptions, invoices, billing, finance. | staff |
| `/staff/customers` | Find and manage customer accounts. | staff |
| `/staff/customers/[id]` | A customer's details, subscriptions and outstanding balance. | staff |
| `/staff/subscriptions` | Every subscription with plan, status and next billing date. | staff |
| `/staff/subscriptions/new` | Build a subscription for a customer from a quotation template. | staff |
| `/staff/subscriptions/[id]` | Review and update a subscription, its lines and its status. | staff |
| `/staff/subscriptions/[id]/quote` | Printable quotation for a subscription before activation. | staff |
| `/staff/billing` | Preview due billing, create the invoices, confirm them, and review run history. | staff |
| `/staff/invoices` | Find invoices and track their payment status. | staff |
| `/staff/invoices/[id]` | Review an invoice, record a payment, print it, send it, cancel it. | staff |
| `/staff/finance` | Invoiced, collected, outstanding, collections by method, largest overdue. | staff |
| `/portal` | Summary of the customer's subscriptions, balance and recent invoices. | customer |
| `/portal/subscriptions` | The customer's own subscriptions. | customer |
| `/portal/invoices` | The customer's own invoices and balances. | customer |
| `/portal/invoices/[id]` | One invoice, with a print view. A foreign id returns 404. | customer |
| `/api/jobs/billing-run` | `POST` with an `x-job-secret` header to run billing from a scheduler. | secret |

## How it is put together

Next.js 15 App Router, TypeScript in strict mode, Tailwind CSS v4, Prisma 6 over PostgreSQL, and
Vitest. The dependency list is deliberately short: `next`, `react`, `@prisma/client`, `prisma`,
`zod`, `jose` for the session JWT, `bcryptjs` for passwords, and `tsx` to run the seed.

The code is split so that the parts which must be correct can be tested without a database:

- **`src/core`** is the engine: pure functions, no Prisma, no React. `pricing.ts` turns lines,
  discounts and taxes into amounts; `money.ts` holds the paise arithmetic and pro-rata allocation;
  `periods.ts` does billing-period maths; `discount.ts` decides eligibility; `state.ts` holds the
  subscription and invoice status rules. Quotes, billing previews and invoices all call the same
  `priceDocument`, so the number the customer is quoted is the number on the invoice.
- **`src/server`** is the only layer that touches the database: `billing.ts` (the run and invoice
  confirmation), `subscriptions.ts` (status changes, lines, numbering), `invoices.ts` (confirm,
  cancel, send), `payments.ts`, `customers.ts`, `auth.ts`, and `db.ts` for the client singleton.
- **`src/app`** holds the three route groups — `(auth)`, `admin`, `staff`, `portal` — plus
  `api/jobs/billing-run`, which lets a scheduler trigger a run with an `x-job-secret` header.
- **`src/contracts`** holds the shared types the three layers agree on.

Two guarantees are enforced by the database rather than by remembering to check:

- **Nothing is billed twice.** `invoices` has `UNIQUE(subscription_id, period_start)`. A second
  invoice for the same subscription and period cannot be inserted, whatever the application does;
  the billing run treats the resulting conflict as "already invoiced" and counts it as skipped.
- **Invoice numbers have no gaps.** Numbers come from the `counters` table
  (`UPDATE … RETURNING` inside the same transaction that confirms the invoice), not from a Postgres
  sequence, which would leave a hole every time a transaction rolled back. Numbers read
  `INV-2026-00001`; subscriptions use the same mechanism under `SUB-2026`.

The billing run itself (`src/server/billing.ts`) takes every active subscription whose next billing
date is on or before the run date, so a day the job did not run is caught up on the next one. Work is
done in batches of 100 with one transaction per batch; anything already invoiced for that period is
counted as skipped, so re-running the same date is harmless.

```
prisma/
  schema.prisma              tables, enums and the two constraints above
  seed.ts                    deterministic demo data
src/
  app/
    (auth)/                  login, register, forgot, reset/[token]
    admin/                   products, plans, discounts, staff
    staff/                   customers, subscriptions, invoices, billing, finance
    portal/                  subscriptions, invoices
    api/jobs/billing-run/    secret-protected run for a scheduler
  components/ui.tsx          shell, cards, tables, badges
  contracts/index.ts         shared types (Paise, PlanPeriod, DiscountRule, …)
  core/                      money, periods, discount, pricing, state
  server/                    auth, billing, subscriptions, invoices, payments, customers, db
tests/
  core/                      pricing, money, periods, discounts, status rules
  server/                    priceSubscription (period end, due date, tax)
```

## Technical details

**Money never touches a float.** Every amount in every table and every function is an integer number
of paise; every percentage is basis points, so 18% GST is `1800` and a 7.5% discount is `750`.
Converting to rupees happens once, at render. Nothing can drift by a rounding error, and
`allocateProRata` distributes a discount across lines so the parts add up to the whole exactly —
the remainder is handed out a paise at a time, never dropped.

**One pricing function, three callers.** The quotation a customer is shown, the billing preview, and
the invoice that is finally issued all call `priceDocument`. There is no second implementation to
disagree with the first. The order of operations is fixed and tested: variant price → line discount →
subscription-level discount spread pro-rata → tax on the discounted amount → totals.

**The billing run is catch-up, batched and idempotent.** It selects everything due on or before the
run date, so a missed day is picked up on the next run rather than lost. It writes one transaction per
100 invoices. Re-running the same date creates nothing: the unique constraint rejects the duplicate
and the run reports it as skipped rather than as an error. A dry run prices everything and writes
nothing.

**Invoice numbering is gap-free on purpose.** A Postgres sequence advances even when a transaction
rolls back, which leaves holes in a legal document series. Numbers are therefore taken from a
`counters` row inside the confirming transaction, `UPDATE … RETURNING`, so a number is only consumed
if the invoice is actually written.

**Authorisation is server-side.** Three route-group layouts call `requireRole` before rendering, and
every server action re-checks the role before touching data — a form posted by hand to an admin
action is refused. The customer portal filters every query on the session's customer id, and a
request for someone else's invoice returns 404 rather than an empty page.

**Sessions.** Passwords are bcrypt hashes; the session is a signed JWT in an `httpOnly` cookie, so
there is no session table to keep in sync. Password resets use a single-use token with a 30-minute
expiry, and the new password is written only when the token is consumed.

**Dates are timezone-aware where it matters.** Billing dates are calendar dates, not instants; the
"today" used by the billing run is computed in IST, so a run at 02:00 local does not bill the previous
day.

**Scale of the demo data.** 60 customers, 6 products with variants, 5 plans, 3 discounts, 1 quotation
template, 1,200 subscriptions — 400 of them due on the demo date — 2,100 invoices and 1,494 payments,
across 17 tables. A billing preview over the 400 due subscriptions prices every line and returns in
about four seconds against a database in another region.

**Tested where it counts.** 61 tests, all against the pure engine and the billing service, with no
database and no browser: the order of operations in pricing, discount eligibility and limits,
month-end clamping in period maths (31 Jan → 28 Feb → 31 Mar, not 28 Mar), pro-rata allocation,
every allowed and refused status transition, and the derivation of invoice status from the money paid
and the due date.

**CI on every push.** `.github/workflows/ci.yml` runs typecheck, the full test suite and a production
build on `main`.

## Data model

The main tables, in `prisma/schema.prisma`:

- `users` — one row per login; role is `admin`, `staff` or `customer`, and a customer user points at
  their `customer`. Emails are stored lowercased and unique.
- `customers` — the company being billed, with contact details and payment terms in days.
- `products` / `product_variants` — the catalogue, with a sales price, an optional tax and variants
  that add to the price.
- `taxes` — a name and a rate in basis points (18% = `1800`).
- `plans` — price, billing period, interval, minimum quantity, availability window and the four
  policy switches.
- `discounts` — the rule, its scope, its limits and a `used_count` that the billing run increments.
- `quotation_templates` / `quotation_template_lines` — a reusable starting offer for a plan.
- `subscriptions` / `subscription_lines` — the live agreement: status, start and expiry, the current
  period and the next billing date, and the priced lines it bills for.
- `invoices` / `invoice_lines` — the document, its totals in paise, and the per-line breakdown of
  discount, taxable amount and tax.
- `discount_redemptions` — which discount was applied to which invoice, for how much; this is what
  the per-customer usage limit is counted from.
- `payments` — money received: method, amount, date, note and who recorded it.
- `billing_runs` — one row per run with the date, whether it was a dry run, counts and duration.
- `counters` — the last used number for each document series.
- `password_resets` — single-use reset tokens with an expiry.

Money is an integer number of paise in every table and every function; percentages are basis points.
Nothing is stored as a float, so no total drifts by a rounding error.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server on port 3000. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run typecheck` | `tsc --noEmit` across the project. |
| `npm test` | Run the whole Vitest suite once. |
| `npm run test:core` | Run only `tests/core`. |
| `npm run verify` | Typecheck, then the full test suite. This is what CI runs. |
| `npm run db:push` | Push `schema.prisma` to the database (no migration files). |
| `npm run db:seed` | Truncate every table and reload the demo data. |
| `npm run db:studio` | Open Prisma Studio against `DATABASE_URL`. |
| `postinstall` | `prisma generate`, so a fresh clone has a client. |

## Testing

61 tests in six files, all run against the pure engine — no database, no browser, no fixtures to
load:

- `tests/core/pricing.test.ts` — order of operations in `priceDocument`: variant price, line
  discount, subscription discount spread across lines, tax on the remainder, totals that add up.
- `tests/core/discount.test.ts` — eligibility (window, minimums, usage limits, per-customer limits)
  and the rule that only the larger of two competing discounts applies.
- `tests/core/periods.test.ts` — daily, weekly, monthly and yearly advances, and the month-end clamp
  (31 Jan → 28 Feb → 31 Mar, not 28 Mar).
- `tests/core/money.test.ts` — paise conversion, half-up rounding and pro-rata allocation that
  distributes the remainder exactly.
- `tests/core/state.test.ts` — every allowed subscription transition, the plan policies that block
  pause, renew and early close, and invoice status derived from amount paid and due date.
- `tests/server/billing.test.ts` — `priceSubscription`: period end per billing frequency, month-end
  clamping, due date from payment terms, and lines without a tax.

```bash
npm test          # or: npm run verify
```

## Limitations

- **Password-reset email needs an SMTP account.** The token flow is complete — single use, expiry,
  hashed password written on use — but nothing sends the mail. With no SMTP configured the link is
  printed to the server log and shown on the reset screen so the flow can be used.
- **Invoices print through the browser.** There is no generated PDF; the print button calls the
  browser's print dialog and the result depends on the browser's page setup.
- **No online payment gateway.** Payments are recorded by staff against an invoice with method,
  amount, date and note. Nothing is collected through the app. "Send invoice" records that it was
  sent; it does not email anything.
- **Expiry is modelled but not enforced.** A subscription carries an expiry date and the plan an
  `autoClose` switch, but nothing closes a subscription when it expires; staff close it explicitly.
- **Tax rates are seed data.** The engine applies tax per product line, but there is no admin screen
  for maintaining the tax table.

## Resetting the demo data

`npm run db:seed` truncates every table in the schema — customers, subscriptions, invoices, payments,
users, counters, everything — and then reloads the fixed demo set: 60 customers, 6 products,
5 plans, 3 discounts, 1 quotation template, 1,200 subscriptions (400 of them due on 2026-10-31),
2,100 invoices and 1,494 payments. It is deterministic, so two runs produce identical data.

Treat it as destructive: any account, subscription or invoice you created by hand is gone. Do not
point it at a database you care about.
