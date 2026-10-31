import { Card, Shell } from "@/components/ui";

const BAR = "rounded-lg bg-[var(--background)] py-2";

export function PageSkeleton({ cardCount, rowCount }: { cardCount: number; rowCount: number }) {
  return (
    <Shell role="staff">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="w-full max-w-xs space-y-2">
          <div className={BAR} />
          <div className={`${BAR} max-w-xs`} />
        </div>
      </div>

      {Array.from({ length: cardCount }, (_, cardIndex) => (
        <Card key={cardIndex}>
          <div className="space-y-3">
            <div className={`${BAR} max-w-xs`} />
            {Array.from({ length: rowCount }, (_, rowIndex) => (
              <div key={rowIndex} className={`${BAR} w-full`} />
            ))}
          </div>
        </Card>
      ))}
    </Shell>
  );
}
