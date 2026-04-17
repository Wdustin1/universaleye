"use client"

import { useEffect } from "react"

export function CursorAutoHide({ idleMs = 3000 }: { idleMs?: number }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const reset = () => {
      document.body.classList.remove("cursor-idle")
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => document.body.classList.add("cursor-idle"), idleMs)
    }
    document.addEventListener("mousemove", reset)
    document.addEventListener("touchstart", reset)
    document.addEventListener("keydown", reset)
    reset()
    return () => {
      document.removeEventListener("mousemove", reset)
      document.removeEventListener("touchstart", reset)
      document.removeEventListener("keydown", reset)
      if (timer) clearTimeout(timer)
    }
  }, [idleMs])
  return null
}
