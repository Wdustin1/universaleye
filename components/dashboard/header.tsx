"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { History } from "lucide-react"

export function DashboardHeader({ defectCount, onDefectHistoryClick }: { defectCount?: number; onDefectHistoryClick?: () => void }) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shadow-[0_1px_3px_0_rgba(0,0,0,0.3)]">
      <div />

      <div className="flex items-center gap-2.5">
        <Image
          src="/logo.jpg"
          alt="Universal Eye"
          width={32}
          height={32}
          className="rounded-md"
        />
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground leading-none">
            Universal Eye
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
            Web Monitoring System
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs px-3 border-border text-foreground hover:bg-accent"
          onClick={onDefectHistoryClick}
        >
          <History className="w-3.5 h-3.5" />
          Defect History
          {defectCount !== undefined && defectCount > 0 && (
            <span className="ml-1 text-[10px] font-mono bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-sm">
              {defectCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  )
}
