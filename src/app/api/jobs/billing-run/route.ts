import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runBilling, todayIST } from "@/server/billing";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobs/billing-run  { asOf?: "YYYY-MM-DD", dryRun?: boolean }
 * Protected by the JOB_SECRET header so a scheduler (or n8n) can trigger it.
 */
export async function POST(request: Request) {
  const secret = process.env.JOB_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "JOB_SECRET is not configured" },
      { status: 503 },
    );
  }
  const provided = Buffer.from(request.headers.get("x-job-secret") ?? "");
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { asOf?: string; dryRun?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine, defaults below
  }

  const asOf = body.asOf ?? todayIST();

  try {
    const result = await runBilling(asOf, {
      dryRun: body.dryRun ?? false,
      triggeredBy: "job",
    });
    return NextResponse.json({ ...result, preview: result.preview.slice(0, 25) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "billing run failed" },
      { status: 500 },
    );
  }
}
