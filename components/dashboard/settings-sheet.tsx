"use client"

import { useCallback, useState } from "react"
import { X, Database, Bell, BellOff, History, ExternalLink } from "lucide-react"
import Link from "next/link"
import { API, apiFetch } from "@/lib/api"
import { usePolling } from "@/hooks/use-polling"

const SOUND_KEY = "ueye:sound-enabled"

export function SettingsSheet({
  open,
  onOpenChange,
  onOpenLog,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenLog: () => void
}) {
  const [collecting, setCollecting] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(SOUND_KEY) === "1" : false
  )

  const pollCollecting = useCallback(async () => {
    try {
      const res = await apiFetch(API.collectionStats)
      if (res.ok) {
        const data = await res.json()
        setCollecting(Boolean(data.collecting))
      }
    } catch { /* offline */ }
  }, [])
  usePolling(pollCollecting, 5000, open)

  const toggleCollecting = async () => {
    const next = !collecting
    setCollecting(next)
    try {
      await apiFetch(next ? API.collectionStart : API.collectionStop, { method: "POST" })
    } catch { /* offline */ }
  }

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    if (typeof window !== "undefined") localStorage.setItem(SOUND_KEY, next ? "1" : "0")
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-canvas/40 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
      )}
      <div
        data-state={open ? "open" : "closed"}
        className={`fixed top-0 right-0 z-50 h-full w-80 bg-card border-l border-border-soft shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
            <h2 className="text-xs font-medium uppercase tracking-wider">Settings</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close settings"
              className="p-1 rounded hover:bg-secondary"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
            <Section title="Training Data">
              <RowButton onClick={toggleCollecting} icon={<Database className="w-4 h-4" />}>
                <span className="flex-1">Collect Frames</span>
                <span className={`text-[11px] font-mono ${collecting ? "text-primary" : "text-muted-foreground"}`}>
                  {collecting ? "● ON" : "OFF"}
                </span>
              </RowButton>
              <Link href="/collect" target="_blank" className="block">
                <RowButton onClick={() => {}} icon={<ExternalLink className="w-4 h-4" />}>
                  <span>Label Frames</span>
                </RowButton>
              </Link>
            </Section>

            <Section title="Sound">
              <RowButton onClick={toggleSound} icon={soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}>
                <span className="flex-1">Critical defect chime</span>
                <span className={`text-[11px] font-mono ${soundEnabled ? "text-primary" : "text-muted-foreground"}`}>
                  {soundEnabled ? "● ON" : "OFF"}
                </span>
              </RowButton>
            </Section>

            <Section title="History">
              <RowButton onClick={() => { onOpenLog(); onOpenChange(false) }} icon={<History className="w-4 h-4" />} aria-label="Open defect history">
                <span>Defect History</span>
              </RowButton>
            </Section>
          </div>
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function RowButton({
  onClick,
  icon,
  children,
  ...rest
}: {
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 h-11 px-3 rounded-lg bg-sunken hover:bg-lifted text-sm transition-colors text-left"
      {...rest}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 flex items-center justify-between gap-2">{children}</span>
    </button>
  )
}
