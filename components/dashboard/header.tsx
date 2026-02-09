"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Settings, Circle, History } from "lucide-react"
import { useState } from "react"

export function DashboardHeader({ defectCount, onDefectHistoryClick }: { defectCount?: number; onDefectHistoryClick?: () => void }) {
  const [currentJob] = useState("JOB-2026-0247")
  const [productName] = useState("Premium Wine Label - Merlot Reserve")

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shadow-[0_1px_3px_0_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-4">
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

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-3">
          <StatusIndicator status="inspecting" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Job</p>
            <p className="text-sm font-medium font-mono text-foreground">{currentJob}</p>
          </div>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          <div className="w-0.5 h-7 rounded-full bg-primary/40" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Product</p>
            <p className="text-sm text-foreground">{productName}</p>
          </div>
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
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="sr-only">Settings</span>
        </Button>
      </div>
    </header>
  )
}

function StatusIndicator({ status }: { status: "inspecting" | "idle" | "paused" | "error" }) {
  const config = {
    inspecting: { label: "Inspecting", pulse: true },
    idle: { label: "Idle", pulse: false },
    paused: { label: "Paused", pulse: false },
    error: { label: "Error", pulse: true },
  }

  const { label, pulse } = config[status]

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary">
      <div className="relative">
        <Circle
          className={`w-2 h-2 fill-current ${
            status === "inspecting"
              ? "text-success"
              : status === "error"
                ? "text-destructive"
                : status === "paused"
                  ? "text-warning"
                  : "text-muted-foreground"
          }`}
        />
        {pulse && (
          <Circle
            className={`w-2 h-2 absolute inset-0 fill-current animate-ping ${
              status === "inspecting" ? "text-success" : "text-destructive"
            }`}
          />
        )}
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </div>
  )
}
