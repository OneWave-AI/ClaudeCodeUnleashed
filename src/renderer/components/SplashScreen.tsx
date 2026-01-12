import { useState, useEffect, useRef } from 'react'

interface SplashScreenProps {
  onComplete: () => void
}

// 7-segment digit patterns: [top, topRight, bottomRight, bottom, bottomLeft, topLeft, middle]
const SEGMENT_PATTERNS: Record<string, boolean[]> = {
  '0': [true, true, true, true, true, true, false],
  '1': [false, true, true, false, false, false, false],
  '2': [true, true, false, true, true, false, true],
  '3': [true, true, true, true, false, false, true],
  '4': [false, true, true, false, false, true, true],
  '5': [true, false, true, true, false, true, true],
  '6': [true, false, true, true, true, true, true],
  '7': [true, true, true, false, false, false, false],
  '8': [true, true, true, true, true, true, true],
  '9': [true, true, true, true, false, true, true],
}

interface SegmentDigitProps {
  digit: string
  isComplete: boolean
  size: number
}

function SegmentDigit({ digit, isComplete, size }: SegmentDigitProps) {
  const pattern = SEGMENT_PATTERNS[digit] || SEGMENT_PATTERNS['0']
  const segmentWidth = size * 0.15
  const segmentLength = size * 0.35
  const gap = size * 0.02

  const activeColor = isComplete ? '#FFD700' : '#ffffff'
  const inactiveColor = 'rgba(255, 255, 255, 0.04)'
  const glowColor = isComplete
    ? '0 0 10px rgba(255, 215, 0, 0.9), 0 0 20px rgba(255, 215, 0, 0.6), 0 0 40px rgba(16, 185, 129, 0.4)'
    : '0 0 5px rgba(255, 255, 255, 0.3)'

  // Segment positions relative to digit container
  const segments = [
    // Top horizontal
    {
      active: pattern[0],
      style: {
        top: 0,
        left: segmentWidth + gap,
        width: segmentLength,
        height: segmentWidth,
        clipPath: 'polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)',
      },
    },
    // Top right vertical
    {
      active: pattern[1],
      style: {
        top: segmentWidth + gap,
        right: 0,
        width: segmentWidth,
        height: segmentLength,
        clipPath: 'polygon(50% 0%, 100% 15%, 100% 85%, 50% 100%, 0% 85%, 0% 15%)',
      },
    },
    // Bottom right vertical
    {
      active: pattern[2],
      style: {
        top: segmentWidth * 2 + segmentLength + gap * 3,
        right: 0,
        width: segmentWidth,
        height: segmentLength,
        clipPath: 'polygon(50% 0%, 100% 15%, 100% 85%, 50% 100%, 0% 85%, 0% 15%)',
      },
    },
    // Bottom horizontal
    {
      active: pattern[3],
      style: {
        bottom: 0,
        left: segmentWidth + gap,
        width: segmentLength,
        height: segmentWidth,
        clipPath: 'polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)',
      },
    },
    // Bottom left vertical
    {
      active: pattern[4],
      style: {
        top: segmentWidth * 2 + segmentLength + gap * 3,
        left: 0,
        width: segmentWidth,
        height: segmentLength,
        clipPath: 'polygon(50% 0%, 100% 15%, 100% 85%, 50% 100%, 0% 85%, 0% 15%)',
      },
    },
    // Top left vertical
    {
      active: pattern[5],
      style: {
        top: segmentWidth + gap,
        left: 0,
        width: segmentWidth,
        height: segmentLength,
        clipPath: 'polygon(50% 0%, 100% 15%, 100% 85%, 50% 100%, 0% 85%, 0% 15%)',
      },
    },
    // Middle horizontal
    {
      active: pattern[6],
      style: {
        top: segmentWidth + segmentLength + gap * 2,
        left: segmentWidth + gap,
        width: segmentLength,
        height: segmentWidth,
        clipPath: 'polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)',
      },
    },
  ]

  const totalWidth = segmentWidth * 2 + segmentLength + gap * 2
  const totalHeight = segmentWidth * 3 + segmentLength * 2 + gap * 4

  return (
    <div
      className="relative"
      style={{
        width: totalWidth,
        height: totalHeight,
      }}
    >
      {segments.map((seg, i) => (
        <div
          key={i}
          className="absolute transition-all duration-150"
          style={{
            ...seg.style,
            backgroundColor: seg.active ? activeColor : inactiveColor,
            boxShadow: seg.active ? glowColor : 'none',
          }}
        />
      ))}
    </div>
  )
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [mounted, setMounted] = useState(false)
  const [phase, setPhase] = useState<'counting' | 'complete' | 'fadeout'>('counting')
  const [count, setCount] = useState(0)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    setMounted(true)

    const totalDuration = 3500
    let animationId: number

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current
      const progress = Math.min(elapsed / totalDuration, 1)

      // Eased progress for smoother counting
      const easedProgress = 1 - Math.pow(1 - progress, 3)

      // Update counter - counts to 100
      setCount(Math.floor(easedProgress * 100))

      // Phase transitions
      if (progress >= 1 && phase === 'counting') {
        setPhase('complete')
        setCount(100)
        setTimeout(() => {
          setPhase('fadeout')
          setTimeout(onComplete, 600)
        }, 500)
      }

      if (progress < 1) {
        animationId = requestAnimationFrame(animate)
      }
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [onComplete, phase])

  // Split number into individual digits
  const digits = count.toString().padStart(3, '0').split('')

  // Responsive digit size
  const digitSize = typeof window !== 'undefined'
    ? Math.min(window.innerWidth * 0.12, 160)
    : 120

  return (
    <div className={`fixed inset-0 z-50 bg-[#020204] transition-opacity duration-600 ${phase === 'fadeout' ? 'opacity-0' : 'opacity-100'}`}>
      {/* Pixelated grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '8px 8px',
        }}
      />

      {/* Scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
          opacity: 0.5,
        }}
      />

      {/* CRT vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Main content */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

        {/* 7-Segment LED Counter Display */}
        <div className="relative">
          {/* Glow backdrop */}
          {phase === 'complete' && (
            <div
              className="absolute inset-0 -inset-x-20 -inset-y-10 blur-3xl animate-pulse"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(255, 215, 0, 0.2) 0%, rgba(16, 185, 129, 0.1) 50%, transparent 70%)',
              }}
            />
          )}

          {/* LED digit display */}
          <div className="flex items-end gap-4">
            {digits.map((digit, i) => (
              <SegmentDigit
                key={i}
                digit={digit}
                isComplete={phase === 'complete'}
                size={digitSize}
              />
            ))}

            {/* Percent symbol */}
            <div
              className="flex flex-col items-center justify-center ml-2 transition-all duration-200"
              style={{
                color: phase === 'complete' ? 'rgba(255, 215, 0, 0.8)' : 'rgba(255, 255, 255, 0.25)',
                fontSize: digitSize * 0.4,
                fontFamily: 'monospace',
                fontWeight: 'bold',
                textShadow: phase === 'complete'
                  ? '0 0 10px rgba(255, 215, 0, 0.8), 0 0 20px rgba(16, 185, 129, 0.5)'
                  : '0 0 3px rgba(255, 255, 255, 0.2)',
              }}
            >
              %
            </div>
          </div>

          {/* LED panel border effect */}
          <div
            className="absolute -inset-6 rounded-lg pointer-events-none"
            style={{
              border: '2px solid rgba(255, 255, 255, 0.05)',
              boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.5)',
            }}
          />
        </div>

        {/* Status text - LED style */}
        <div className="mt-16 font-mono">
          <span
            className="transition-all duration-300 text-xs uppercase tracking-[0.5em]"
            style={{
              color: phase === 'complete' ? '#FFD700' : 'rgba(255, 255, 255, 0.3)',
              textShadow: phase === 'complete'
                ? '0 0 10px rgba(255, 215, 0, 0.9), 0 0 30px rgba(16, 185, 129, 0.6)'
                : '0 0 2px rgba(255, 255, 255, 0.2)',
            }}
          >
            {phase === 'complete' ? 'SYSTEM READY' : 'INITIALIZING'}
          </span>
          {phase === 'counting' && (
            <span
              className="animate-pulse"
              style={{ color: 'rgba(255, 255, 255, 0.3)' }}
            >
              _
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-8 w-64 h-1 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-100 rounded-full"
            style={{
              width: `${count}%`,
              background: phase === 'complete'
                ? 'linear-gradient(90deg, #FFD700, #10B981)'
                : 'rgba(255, 255, 255, 0.3)',
              boxShadow: phase === 'complete'
                ? '0 0 10px rgba(255, 215, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.3)'
                : '0 0 5px rgba(255, 255, 255, 0.1)',
            }}
          />
        </div>
      </div>

      {/* Corner system indicators */}
      <div className="absolute top-5 left-5 text-white/[0.06] font-mono text-[10px] tracking-widest">SYS.BOOT</div>
      <div className="absolute top-5 right-5 text-white/[0.06] font-mono text-[10px] tracking-widest">v2.0.0</div>
      <div className="absolute bottom-5 left-5 text-white/[0.06] font-mono text-[10px] tracking-widest">&gt;&gt;&gt;</div>
      <div className="absolute bottom-5 right-5 text-white/[0.06] font-mono text-[10px] tracking-widest">&lt;&lt;&lt;</div>
    </div>
  )
}
