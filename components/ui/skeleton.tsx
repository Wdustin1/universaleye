import { cn } from "@/lib/utils"

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded bg-sunken animate-pulse", className)}
      aria-hidden="true"
    />
  )
}
