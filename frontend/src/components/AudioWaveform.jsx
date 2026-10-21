import React, { useEffect, useRef } from 'react'

export function AudioWaveform({ isActive = true, isProcessing = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId
    let phase = 0

    const render = () => {
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      const bars = 48
      const barWidth = 4
      const gap = (width - bars * barWidth) / (bars - 1)

      for (let i = 0; i < bars; i++) {
        // Compute wave amplitude
        const normalizedIndex = i / bars
        const distanceToCenter = Math.abs(normalizedIndex - 0.5) * 2
        const envelope = Math.cos(distanceToCenter * Math.PI * 0.5)

        let barHeight = 6
        if (isActive || isProcessing) {
          const speed = isProcessing ? 0.08 : 0.04
          const wave1 = Math.sin(phase + i * 0.25)
          const wave2 = Math.cos(phase * 0.7 + i * 0.4)
          const wave3 = Math.sin(phase * 1.3 - i * 0.15)
          const combined = (wave1 + wave2 + wave3) / 3
          const variance = isProcessing ? 35 : 24
          barHeight = Math.max(6, Math.abs(combined * variance * envelope) + 8)
        }

        const x = i * (barWidth + gap)
        const y = (height - barHeight) / 2

        // Gradient coloring
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight)
        if (isProcessing) {
          grad.addColorStop(0, '#8b5cf6') // violet
          grad.addColorStop(0.5, '#06b6d4') // cyan
          grad.addColorStop(1, '#10b981') // emerald
        } else if (isActive) {
          grad.addColorStop(0, '#06b6d4')
          grad.addColorStop(0.5, '#10b981')
          grad.addColorStop(1, '#34d399')
        } else {
          grad.addColorStop(0, '#334155')
          grad.addColorStop(1, '#1e293b')
        }

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 2, 2])
        ctx.fill()

        // Glow reflection on central bars
        if ((isActive || isProcessing) && i >= 16 && i <= 32) {
          ctx.shadowColor = isProcessing ? 'rgba(139, 92, 246, 0.4)' : 'rgba(6, 182, 212, 0.4)'
          ctx.shadowBlur = 10
        } else {
          ctx.shadowBlur = 0
        }
      }

      phase += isProcessing ? 0.09 : 0.05
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [isActive, isProcessing])

  return (
    <div className="relative w-full flex items-center justify-center py-2">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-cyan-500/20 to-violet-500/10 blur-xl rounded-full opacity-60 pointer-events-none" />
      <canvas
        ref={canvasRef}
        width={420}
        height={70}
        className="relative z-10 w-full max-w-[420px] h-[70px]"
      />
    </div>
  )
}
