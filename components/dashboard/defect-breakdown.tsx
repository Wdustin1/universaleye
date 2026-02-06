"use client"

const DEFECT_DATA = [
  { type: "Smudge", count: 7, percentage: 30.4 },
  { type: "Misregister", count: 5, percentage: 21.7 },
  { type: "Hickey", count: 4, percentage: 17.4 },
  { type: "Color Shift", count: 3, percentage: 13.0 },
  { type: "Scratch", count: 2, percentage: 8.7 },
  { type: "Other", count: 2, percentage: 8.7 },
]

export function DefectBreakdown() {
  const maxCount = Math.max(...DEFECT_DATA.map((d) => d.count))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
          Defect Classification
        </h2>
        <span className="text-[10px] font-mono text-muted-foreground">
          23 total
        </span>
      </div>
      <div className="flex-1 p-3 flex flex-col gap-2.5">
        {DEFECT_DATA.map((item) => (
          <div key={item.type} className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground w-20 text-right truncate">
              {item.type}
            </span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  backgroundColor:
                    item.count >= 5
                      ? "hsl(var(--destructive))"
                      : item.count >= 3
                        ? "hsl(var(--warning))"
                        : "hsl(var(--primary))",
                }}
              />
            </div>
            <div className="flex items-center gap-1.5 w-16">
              <span className="text-[10px] font-mono font-medium text-foreground">
                {item.count}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {item.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
