"use client"

export function AnimatedNumber({ value, className }: { value: string | number; className?: string }) {
  return (
    <span
      key={String(value)}
      className={`inline-block ${className ?? ""}`}
      style={{ animation: "value-pop 200ms cubic-bezier(0.4, 0, 0.2, 1) both" }}
    >
      {value}
    </span>
  )
}
