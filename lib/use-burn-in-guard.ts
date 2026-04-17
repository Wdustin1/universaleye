import { useEffect, useState } from "react"

export function useBurnInGuard() {
  const [shift, setShift] = useState({ x: 0, y: 0, dim: false })

  useEffect(() => {
    let lastInput = Date.now()
    const reset = () => { lastInput = Date.now() }
    document.addEventListener("mousemove", reset)
    document.addEventListener("touchstart", reset)
    document.addEventListener("keydown", reset)

    const tick = setInterval(() => {
      const idleSec = (Date.now() - lastInput) / 1000
      if (idleSec < 60) { setShift({ x: 0, y: 0, dim: false }); return }
      const minute = Math.floor(idleSec / 60)
      const angle = (minute % 4) * (Math.PI / 2)
      setShift({ x: Math.round(Math.cos(angle) * 2), y: Math.round(Math.sin(angle) * 2), dim: idleSec > 600 })
    }, 30000)

    return () => {
      document.removeEventListener("mousemove", reset)
      document.removeEventListener("touchstart", reset)
      document.removeEventListener("keydown", reset)
      clearInterval(tick)
    }
  }, [])

  return {
    transform: `translate(${shift.x}px, ${shift.y}px)`,
    filter: shift.dim ? "brightness(0.92)" : undefined,
    transition: "transform 8s linear, filter 8s linear",
  } as const
}
