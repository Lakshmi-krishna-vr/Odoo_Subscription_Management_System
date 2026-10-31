import { PageSkeleton } from "@/app/staff/invoices/page-skeleton";

export default function Loading() {
  return <PageSkeleton cardCount={2} rowCount={4} />;
}
