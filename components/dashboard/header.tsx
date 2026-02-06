"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Settings, Circle } from "lucide-react"
import { useState } from "react"

export function DashboardHeader() {
  const [currentJob] = useState("JOB-2026-0247")
  const [productName] = useState("Premium Wine Label - Merlot Reserve")

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Universal Eye"
            width={36}
            height={36}
            className="rounded"
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
            <p className="text-xs text-muted-foreground">Active Job</p>
            <p className="text-sm font-medium font-mono text-foreground">{currentJob}</p>
          </div>
        </div>

        <div className="h-6 w-px bg-border" />

        <div>
          <p className="text-xs text-muted-foreground">Product</p>
          <p className="text-sm text-foreground">{productName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
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
    inspecting: { label: "Inspecting", color: "bg-success", pulse: true },
    idle: { label: "Idle", color: "bg-muted-foreground", pulse: false },
    paused: { label: "Paused", color: "hsl(var(--warning))", pulse: false },
    error: { label: "Error", color: "bg-destructive", pulse: true },
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
