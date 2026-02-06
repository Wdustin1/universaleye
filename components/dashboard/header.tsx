"use client"

import { useState } from "react"
import {
  Eye,
  Settings,
  Bell,
  ChevronDown,
  Circle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function DashboardHeader() {
  const [currentJob] = useState("JOB-2026-0247")
  const [productName] = useState("Premium Wine Label - Merlot Reserve")

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
            <Eye className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground leading-none">
              Universal Eye
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
              Inspection System
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
              Camera 1
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Camera 1</DropdownMenuItem>
            <DropdownMenuItem>Camera 2</DropdownMenuItem>
            <DropdownMenuItem>Camera 3</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
          <span className="sr-only">Notifications</span>
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
