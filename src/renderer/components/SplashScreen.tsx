import { useState, useEffect } from 'react'

interface SplashScreenProps {
  onComplete: () => void
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('Initializing systems...')
  const [phase, setPhase] = useState<'loading' | 'complete' | 'fadeout'>('loading')

  useEffect(() => {
    // Simulate loading progress with status updates
    const stages = [
      { progress: 15, text: 'Loading core modules...', delay: 300 },
      { progress: 35, text: 'Connecting to Claude...', delay: 600 },
      { progress: 55, text: 'Preparing workspace...', delay: 900 },
      { progress: 75, text: 'Loading skills & agents...', delay: 1200 },
      { progress: 90, text: 'Almost ready...', delay: 1500 },
      { progress: 100, text: 'Ready!', delay: 1800 },
    ]

    const timers: NodeJS.Timeout[] = []

    stages.forEach(({ progress: p, text, delay }) => {
      timers.push(setTimeout(() => {
        setProgress(p)
        setStatusText(text)
        if (p === 100) setPhase('complete')
      }, delay))
    })

    // Fade out
    timers.push(setTimeout(() => setPhase('fadeout'), 2200))
    // Complete
    timers.push(setTimeout(() => onComplete(), 2600))

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#030308] transition-opacity duration-400 ${
        phase === 'fadeout' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'center top'
          }}
        />

        {/* Floating orbs */}
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-[#cc785c]/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '500ms' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1000ms' }} />

        {/* Moving particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-8">
        {/* 3D Cube Loader */}
        <div className="relative w-24 h-24 mb-10" style={{ perspective: '200px' }}>
          <div
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              animation: 'rotateCube 3s ease-in-out infinite'
            }}
          >
            {/* Cube faces */}
            {['front', 'back', 'left', 'right', 'top', 'bottom'].map((face, i) => {
              const transforms: Record<string, string> = {
                front: 'translateZ(48px)',
                back: 'translateZ(-48px) rotateY(180deg)',
                left: 'translateX(-48px) rotateY(-90deg)',
                right: 'translateX(48px) rotateY(90deg)',
                top: 'translateY(-48px) rotateX(90deg)',
                bottom: 'translateY(48px) rotateX(-90deg)'
              }
              return (
                <div
                  key={face}
                  className="absolute inset-0 border-2 rounded-xl"
                  style={{
                    transform: transforms[face],
                    background: `linear-gradient(135deg, rgba(139, 92, 246, ${0.1 + i * 0.05}), rgba(204, 120, 92, ${0.1 + i * 0.05}))`,
                    borderColor: `rgba(139, 92, 246, ${0.3 + i * 0.1})`,
                    boxShadow: 'inset 0 0 30px rgba(139, 92, 246, 0.1)'
                  }}
                />
              )
            })}

            {/* Inner glow */}
            <div
              className="absolute inset-4 rounded-lg"
              style={{
                transform: 'translateZ(24px)',
                background: 'radial-gradient(circle, rgba(204, 120, 92, 0.4) 0%, transparent 70%)',
                animation: 'pulse 2s ease-in-out infinite'
              }}
            />
          </div>

          {/* Orbiting rings */}
          <div
            className="absolute inset-[-20px] border border-purple-500/20 rounded-full"
            style={{ animation: 'spin 4s linear infinite' }}
          />
          <div
            className="absolute inset-[-35px] border border-[#cc785c]/20 rounded-full"
            style={{ animation: 'spin 6s linear infinite reverse' }}
          />
          <div
            className="absolute inset-[-50px] border border-purple-500/10 rounded-full"
            style={{ animation: 'spin 8s linear infinite' }}
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-2 tracking-tight">
          <span className="text-white">Claude</span>
          <span className="bg-gradient-to-r from-[#cc785c] to-[#e8956e] bg-clip-text text-transparent">Code</span>
          <span className="bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent ml-2">Arena</span>
        </h1>

        {/* Status text */}
        <p className={`text-sm mb-8 transition-all duration-300 ${
          phase === 'complete' ? 'text-green-400' : 'text-gray-500'
        }`}>
          {statusText}
        </p>

        {/* Progress bar container */}
        <div className="w-80 relative">
          {/* Background track */}
          <div className="h-2 bg-white/5 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
            {/* Progress fill */}
            <div
              className="h-full rounded-full relative transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #8b5cf6 0%, #cc785c 50%, #e8956e 100%)'
              }}
            >
              {/* Shimmer effect */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  animation: 'shimmer 1.5s ease-in-out infinite'
                }}
              />
            </div>
          </div>

          {/* Progress percentage */}
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-600">Loading</span>
            <span className="text-xs text-gray-400 font-mono">{progress}%</span>
          </div>

          {/* Glow under progress bar */}
          <div
            className="absolute -bottom-4 left-0 h-8 rounded-full blur-xl transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.3), rgba(204, 120, 92, 0.3))'
            }}
          />
        </div>

        {/* System info */}
        <div className="mt-12 flex items-center gap-6 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${progress > 30 ? 'bg-green-500' : 'bg-gray-600'} transition-colors`} />
            <span>Core</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${progress > 50 ? 'bg-green-500' : 'bg-gray-600'} transition-colors`} />
            <span>Claude CLI</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${progress > 70 ? 'bg-green-500' : 'bg-gray-600'} transition-colors`} />
            <span>Workspace</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-gray-600'} transition-colors`} />
            <span>Ready</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes rotateCube {
          0%, 100% { transform: rotateX(-20deg) rotateY(0deg); }
          25% { transform: rotateX(-20deg) rotateY(90deg); }
          50% { transform: rotateX(-20deg) rotateY(180deg); }
          75% { transform: rotateX(-20deg) rotateY(270deg); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50% { transform: translateY(-10px) translateX(-10px); opacity: 0.3; }
          75% { transform: translateY(-30px) translateX(5px); opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
