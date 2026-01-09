import { useState, useEffect } from 'react'

interface SplashScreenProps {
  onComplete: () => void
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'logo' | 'text' | 'fadeout'>('logo')

  useEffect(() => {
    // Phase 1: Logo animation (0-800ms)
    const textTimer = setTimeout(() => setPhase('text'), 800)
    // Phase 2: Text appears (800-1800ms)
    const fadeTimer = setTimeout(() => setPhase('fadeout'), 1800)
    // Phase 3: Fade out and complete (1800-2200ms)
    const completeTimer = setTimeout(() => onComplete(), 2200)

    return () => {
      clearTimeout(textTimer)
      clearTimeout(fadeTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0c] transition-opacity duration-400 ${
        phase === 'fadeout' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#cc785c]/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Content */}
      <div className="relative flex flex-col items-center">
        {/* Animated Logo */}
        <div className={`relative transition-all duration-700 ${phase !== 'logo' ? 'scale-90' : 'scale-100'}`}>
          {/* Outer ring - rotating */}
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            className="animate-spin-slow"
            style={{ animationDuration: '8s' }}
          >
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#cc785c" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#cc785c" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <circle
              cx="60"
              cy="60"
              r="55"
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="2"
              strokeDasharray="40 20"
            />
          </svg>

          {/* Inner logo container */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-900/60 to-[#1a0a2e] border border-purple-500/30 flex items-center justify-center shadow-2xl shadow-purple-500/20 transition-all duration-500 ${
                phase === 'logo' ? 'scale-0 rotate-180' : 'scale-100 rotate-0'
              }`}
              style={{ transitionDelay: '100ms' }}
            >
              {/* Arena logo SVG */}
              <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
                <defs>
                  <linearGradient id="splashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#cc785c" />
                    <stop offset="100%" stopColor="#e8956e" />
                  </linearGradient>
                </defs>
                {/* Hexagon arena */}
                <polygon
                  points="24,4 44,14 44,34 24,44 4,34 4,14"
                  fill="none"
                  stroke="url(#splashGrad)"
                  strokeWidth="2"
                  opacity="0.6"
                  className={`transition-all duration-500 ${phase !== 'logo' ? 'opacity-60' : 'opacity-0'}`}
                  style={{ transitionDelay: '200ms' }}
                />
                {/* Inner hexagon */}
                <polygon
                  points="24,10 38,17 38,31 24,38 10,31 10,17"
                  fill="none"
                  stroke="url(#splashGrad)"
                  strokeWidth="1.5"
                  opacity="0.4"
                  className={`transition-all duration-500 ${phase !== 'logo' ? 'opacity-40' : 'opacity-0'}`}
                  style={{ transitionDelay: '300ms' }}
                />
                {/* Code brackets */}
                <path
                  d="M17,17 Q12,24 17,31"
                  fill="none"
                  stroke="url(#splashGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className={`transition-all duration-500 ${phase !== 'logo' ? 'opacity-100' : 'opacity-0'}`}
                  style={{ transitionDelay: '400ms' }}
                />
                <path
                  d="M31,17 Q36,24 31,31"
                  fill="none"
                  stroke="url(#splashGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className={`transition-all duration-500 ${phase !== 'logo' ? 'opacity-100' : 'opacity-0'}`}
                  style={{ transitionDelay: '400ms' }}
                />
                {/* Center cursor - blinking */}
                <rect
                  x="21"
                  y="19"
                  width="6"
                  height="10"
                  rx="1"
                  fill="url(#splashGrad)"
                  className={`transition-all duration-300 ${phase !== 'logo' ? 'opacity-100' : 'opacity-0'}`}
                  style={{ transitionDelay: '500ms' }}
                >
                  <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
                </rect>
              </svg>
            </div>
          </div>

          {/* Particles */}
          <div className="absolute inset-0">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1.5 h-1.5 bg-[#cc785c] rounded-full animate-ping"
                style={{
                  left: `${50 + 45 * Math.cos((i * Math.PI * 2) / 6)}%`,
                  top: `${50 + 45 * Math.sin((i * Math.PI * 2) / 6)}%`,
                  animationDelay: `${i * 150}ms`,
                  animationDuration: '1.5s'
                }}
              />
            ))}
          </div>
        </div>

        {/* Text */}
        <div
          className={`mt-8 text-center transition-all duration-500 ${
            phase === 'text' || phase === 'fadeout'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
        >
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-white">Claude</span>
            <span className="bg-gradient-to-r from-[#cc785c] to-[#e8956e] bg-clip-text text-transparent">Code</span>
            <span className="bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent ml-1">Arena</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">Initializing...</p>
        </div>

        {/* Loading bar */}
        <div
          className={`mt-6 w-48 h-1 bg-white/10 rounded-full overflow-hidden transition-all duration-500 ${
            phase === 'text' || phase === 'fadeout' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className="h-full bg-gradient-to-r from-[#cc785c] to-purple-500 rounded-full transition-all duration-1000"
            style={{ width: phase === 'fadeout' ? '100%' : '60%' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow linear infinite;
        }
      `}</style>
    </div>
  )
}
