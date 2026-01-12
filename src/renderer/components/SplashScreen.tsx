import { useState, useEffect, useRef } from 'react'

interface SplashScreenProps {
  onComplete: () => void
}

interface Particle {
  x: number
  y: number
  z: number
  angle: number
  radius: number
  speed: number
  size: number
  opacity: number
  hue: number
  verticalSpeed: number
  type: 'core' | 'ember' | 'sparkle' | 'dust' | 'wisp' | 'ring'
  trail: { x: number; y: number; opacity: number }[]
  pulsePhase: number
  life: number
  maxLife: number
}

interface LightRay {
  angle: number
  length: number
  width: number
  speed: number
  opacity: number
  hue: number
}

interface EnergyArc {
  startAngle: number
  endAngle: number
  radius: number
  life: number
  maxLife: number
  hue: number
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'building' | 'spinning' | 'burst' | 'fadeout'>('building')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // High DPI setup
    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const width = window.innerWidth
    const height = window.innerHeight
    const centerX = width / 2
    const centerY = height / 2

    // Particles array
    const particles: Particle[] = []
    const lightRays: LightRay[] = []
    const energyArcs: EnergyArc[] = []

    // Create diverse particle types
    const createParticle = (type: Particle['type'], delay: number = 0): Particle => {
      const configs = {
        core: { radius: [50, 140], speed: [0.01, 0.02], size: [4, 10], hue: [15, 35], vSpeed: [-0.8, -2] },
        ember: { radius: [70, 100], speed: [0.006, 0.012], size: [12, 22], hue: [18, 38], vSpeed: [-0.3, -1] },
        sparkle: { radius: [35, 170], speed: [0.025, 0.045], size: [1.5, 3], hue: [25, 50], vSpeed: [-1.5, -3] },
        dust: { radius: [100, 220], speed: [0.003, 0.008], size: [1, 2.5], hue: [20, 40], vSpeed: [-0.1, -0.5] },
        wisp: { radius: [60, 130], speed: [0.015, 0.025], size: [6, 14], hue: [280, 320], vSpeed: [-0.5, -1.2] },
        ring: { radius: [80, 150], speed: [0.008, 0.015], size: [2, 4], hue: [35, 55], vSpeed: [-0.2, -0.6] }
      }
      const c = configs[type]
      return {
        x: centerX, y: centerY, z: Math.random() * 350 - 175,
        angle: Math.random() * Math.PI * 2,
        radius: c.radius[0] + Math.random() * (c.radius[1] - c.radius[0]),
        speed: c.speed[0] + Math.random() * (c.speed[1] - c.speed[0]),
        size: c.size[0] + Math.random() * (c.size[1] - c.size[0]),
        opacity: 0,
        hue: c.hue[0] + Math.random() * (c.hue[1] - c.hue[0]),
        verticalSpeed: c.vSpeed[0] + Math.random() * (c.vSpeed[1] - c.vSpeed[0]),
        type,
        trail: [],
        pulsePhase: Math.random() * Math.PI * 2,
        life: -delay,
        maxLife: 10000 + Math.random() * 5000
      }
    }

    // Create particles with variety
    for (let i = 0; i < 100; i++) particles.push(createParticle('core', i * 12))
    for (let i = 0; i < 25; i++) particles.push(createParticle('ember', i * 40 + 200))
    for (let i = 0; i < 40; i++) particles.push(createParticle('sparkle', i * 25))
    for (let i = 0; i < 60; i++) particles.push(createParticle('dust', i * 15 + 100))
    for (let i = 0; i < 20; i++) particles.push(createParticle('wisp', i * 50 + 300))
    for (let i = 0; i < 30; i++) particles.push(createParticle('ring', i * 30 + 500))

    // Create light rays
    for (let i = 0; i < 12; i++) {
      lightRays.push({
        angle: (i / 12) * Math.PI * 2 + Math.random() * 0.3,
        length: 150 + Math.random() * 200,
        width: 20 + Math.random() * 40,
        speed: 0.002 + Math.random() * 0.003,
        opacity: 0.08 + Math.random() * 0.12,
        hue: 20 + Math.random() * 20
      })
    }

    let startTime = Date.now()
    const totalDuration = 6500 // Slower, more refined timing
    let animationId: number
    let currentPhase: typeof phase = 'building'
    let burstStartTime = 0
    let shakeIntensity = 0

    // Nebula background colors
    const nebulaColors = [
      { x: 0.2, y: 0.3, hue: 280, size: 0.4 },
      { x: 0.8, y: 0.7, hue: 20, size: 0.35 },
      { x: 0.5, y: 0.2, hue: 320, size: 0.3 },
      { x: 0.3, y: 0.8, hue: 35, size: 0.25 }
    ]

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progressPercent = Math.min(elapsed / totalDuration, 1)
      setProgress(Math.round(progressPercent * 100))

      // Phase transitions - slower, more deliberate
      if (elapsed > 1500 && currentPhase === 'building') {
        currentPhase = 'spinning'
        setPhase('spinning')
      }
      if (elapsed > 5200 && currentPhase === 'spinning') {
        currentPhase = 'burst'
        burstStartTime = Date.now()
        setPhase('burst')
        shakeIntensity = 6
      }
      if (elapsed > 5900 && currentPhase === 'burst') {
        currentPhase = 'fadeout'
        setPhase('fadeout')
      }

      // Screen shake decay
      shakeIntensity *= 0.92

      // Apply shake offset
      const shakeX = (Math.random() - 0.5) * shakeIntensity
      const shakeY = (Math.random() - 0.5) * shakeIntensity

      ctx.save()
      ctx.translate(shakeX, shakeY)

      // Clear with deep space gradient
      const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.8)
      bgGradient.addColorStop(0, '#0a0812')
      bgGradient.addColorStop(0.5, '#050308')
      bgGradient.addColorStop(1, '#020104')
      ctx.fillStyle = bgGradient
      ctx.fillRect(-20, -20, width + 40, height + 40)

      // Motion blur overlay
      ctx.fillStyle = 'rgba(5, 3, 8, 0.15)'
      ctx.fillRect(-20, -20, width + 40, height + 40)

      const buildProgress = Math.min(elapsed / 1200, 1)
      const spinProgress = currentPhase === 'building' ? 0 : Math.min((elapsed - 1200) / 3300, 1)
      const speedMultiplier = 0.2 + buildProgress * 0.8 + spinProgress * 4
      const pulseTime = elapsed / 100

      // Burst calculations
      const burstElapsed = burstStartTime > 0 ? Date.now() - burstStartTime : 0
      const burstProgress = Math.min(burstElapsed / 600, 1)
      const burstRadius = (currentPhase === 'burst' || currentPhase === 'fadeout')
        ? easeOutQuart(burstProgress) * 500 : 0

      // Draw animated nebula background
      if (currentPhase !== 'fadeout') {
        ctx.globalCompositeOperation = 'screen'
        nebulaColors.forEach((nebula, i) => {
          const pulse = Math.sin(pulseTime * 0.02 + i) * 0.3 + 1
          const nx = nebula.x * width + Math.sin(pulseTime * 0.01 + i * 2) * 30
          const ny = nebula.y * height + Math.cos(pulseTime * 0.015 + i) * 20
          const size = nebula.size * Math.min(width, height) * pulse

          const nebulaGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, size)
          const opacity = 0.06 * buildProgress * (1 - burstProgress * 0.8)
          nebulaGrad.addColorStop(0, `hsla(${nebula.hue}, 70%, 40%, ${opacity})`)
          nebulaGrad.addColorStop(0.4, `hsla(${nebula.hue}, 60%, 25%, ${opacity * 0.5})`)
          nebulaGrad.addColorStop(1, 'transparent')
          ctx.fillStyle = nebulaGrad
          ctx.fillRect(0, 0, width, height)
        })
        ctx.globalCompositeOperation = 'source-over'
      }

      // Draw light rays emanating from center
      if (currentPhase !== 'fadeout' && buildProgress > 0.3) {
        ctx.globalCompositeOperation = 'screen'
        lightRays.forEach(ray => {
          ray.angle += ray.speed * speedMultiplier

          const rayOpacity = ray.opacity * buildProgress * (1 - burstProgress * 0.9)
          const rayLength = ray.length * (1 + spinProgress * 0.5) + burstRadius * 0.3

          ctx.save()
          ctx.translate(centerX, centerY)
          ctx.rotate(ray.angle)

          const rayGrad = ctx.createLinearGradient(0, 0, rayLength, 0)
          rayGrad.addColorStop(0, `hsla(${ray.hue}, 80%, 70%, ${rayOpacity})`)
          rayGrad.addColorStop(0.3, `hsla(${ray.hue}, 70%, 55%, ${rayOpacity * 0.4})`)
          rayGrad.addColorStop(1, 'transparent')

          ctx.fillStyle = rayGrad
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(rayLength, -ray.width / 2)
          ctx.lineTo(rayLength, ray.width / 2)
          ctx.closePath()
          ctx.fill()

          ctx.restore()
        })
        ctx.globalCompositeOperation = 'source-over'
      }

      // Draw vortex center glow
      if (currentPhase !== 'fadeout') {
        for (let layer = 0; layer < 4; layer++) {
          const layerRadius = 60 + layer * 40
          const pulse = Math.sin(pulseTime * 0.08 + layer * 0.7) * 0.2 + 1
          const layerOpacity = (0.15 - layer * 0.025) * buildProgress * (1 - burstProgress * 0.8)

          const vortexGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, layerRadius * pulse)
          vortexGrad.addColorStop(0, `rgba(232, 149, 110, ${layerOpacity})`)
          vortexGrad.addColorStop(0.4, `rgba(204, 120, 92, ${layerOpacity * 0.6})`)
          vortexGrad.addColorStop(0.7, `rgba(168, 85, 247, ${layerOpacity * 0.2})`)
          vortexGrad.addColorStop(1, 'transparent')
          ctx.fillStyle = vortexGrad
          ctx.fillRect(0, 0, width, height)
        }
      }

      // Add energy arcs occasionally
      if (spinProgress > 0.3 && Math.random() < 0.03 * speedMultiplier && currentPhase !== 'fadeout') {
        energyArcs.push({
          startAngle: Math.random() * Math.PI * 2,
          endAngle: Math.random() * Math.PI * 2,
          radius: 60 + Math.random() * 100,
          life: 0,
          maxLife: 300 + Math.random() * 200,
          hue: Math.random() > 0.5 ? 25 + Math.random() * 20 : 280 + Math.random() * 40
        })
      }

      // Draw energy arcs
      ctx.globalCompositeOperation = 'screen'
      for (let i = energyArcs.length - 1; i >= 0; i--) {
        const arc = energyArcs[i]
        arc.life += 16
        if (arc.life > arc.maxLife) {
          energyArcs.splice(i, 1)
          continue
        }

        const arcProgress = arc.life / arc.maxLife
        const arcOpacity = Math.sin(arcProgress * Math.PI) * 0.6

        ctx.strokeStyle = `hsla(${arc.hue}, 100%, 70%, ${arcOpacity})`
        ctx.lineWidth = 2
        ctx.shadowColor = `hsla(${arc.hue}, 100%, 60%, 0.8)`
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(centerX, centerY, arc.radius, arc.startAngle, arc.endAngle)
        ctx.stroke()
        ctx.shadowBlur = 0
      }
      ctx.globalCompositeOperation = 'source-over'

      // Sort particles by depth
      particles.sort((a, b) => a.z - b.z)

      // Update and draw particles
      for (const p of particles) {
        p.life += 16

        if (p.life < 0) continue

        // Fade in - smoother, longer fade
        const fadeIn = Math.min(p.life / 900, 1)
        const baseOpacity = p.type === 'ember' ? 0.6 : p.type === 'sparkle' ? 0.9 : p.type === 'dust' ? 0.4 : p.type === 'wisp' ? 0.5 : p.type === 'ring' ? 0.6 : 0.75
        p.opacity = fadeIn * baseOpacity

        // Fade out during burst
        if (currentPhase === 'fadeout') p.opacity *= 1 - burstProgress

        // Update position
        const particleSpeedMult = speedMultiplier * (
          p.type === 'sparkle' ? 1.5 : p.type === 'dust' ? 0.5 : p.type === 'wisp' ? 1.2 : p.type === 'ember' ? 0.6 : 1
        )
        p.angle += p.speed * particleSpeedMult

        // Tornado funnel shape
        const normalizedZ = (p.z + 175) / 350
        const funnelFactor = 0.2 + normalizedZ * 0.8
        let funnelRadius = p.radius * funnelFactor

        // Burst expansion
        if (currentPhase === 'burst' || currentPhase === 'fadeout') {
          funnelRadius += burstRadius * (0.5 + p.radius / 200)
        }

        // Calculate 3D position
        const prevX = p.x
        const prevY = p.y
        p.x = centerX + Math.cos(p.angle) * funnelRadius
        p.y = centerY + Math.sin(p.angle * 0.6) * 30 + p.z * 0.3

        // Vertical movement
        p.z += p.verticalSpeed * particleSpeedMult * 0.3
        if (p.z < -200) p.z = 200
        if (p.z > 200) p.z = -200

        // Update trail
        if (p.type === 'core' || p.type === 'sparkle' || p.type === 'wisp') {
          p.trail.unshift({ x: p.x, y: p.y, opacity: p.opacity })
          const maxTrail = p.type === 'sparkle' ? 12 : p.type === 'wisp' ? 15 : 8
          if (p.trail.length > maxTrail) p.trail.pop()
        }

        // Visual properties
        const depthScale = 0.5 + (p.z + 175) / 400
        const size = p.size * Math.max(0.3, depthScale)
        const pulse = Math.sin(pulseTime * 0.1 + p.pulsePhase) * 0.2 + 1
        const saturation = 70 + depthScale * 25
        const lightness = 50 + depthScale * 15

        ctx.save()
        ctx.globalAlpha = p.opacity * Math.max(0.25, depthScale)

        // Draw trail
        if (p.trail.length > 1) {
          ctx.beginPath()
          ctx.moveTo(p.trail[0].x, p.trail[0].y)
          for (let j = 1; j < p.trail.length; j++) {
            ctx.lineTo(p.trail[j].x, p.trail[j].y)
          }
          const trailGrad = ctx.createLinearGradient(
            p.trail[0].x, p.trail[0].y,
            p.trail[p.trail.length - 1].x, p.trail[p.trail.length - 1].y
          )
          trailGrad.addColorStop(0, `hsla(${p.hue}, ${saturation}%, ${lightness}%, ${p.opacity * 0.6})`)
          trailGrad.addColorStop(1, 'transparent')
          ctx.strokeStyle = trailGrad
          ctx.lineWidth = size * (p.type === 'wisp' ? 0.8 : 0.4)
          ctx.lineCap = 'round'
          ctx.stroke()
        }

        // Draw particle by type
        if (p.type === 'ember') {
          // Multi-layered glow ember
          for (let layer = 3; layer >= 0; layer--) {
            const glowSize = size * (1 + layer * 0.8) * pulse
            const glowOpacity = 0.3 / (layer + 1)

            const emberGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize)
            emberGrad.addColorStop(0, `hsla(${p.hue}, 100%, 75%, ${glowOpacity})`)
            emberGrad.addColorStop(0.3, `hsla(${p.hue}, 95%, 60%, ${glowOpacity * 0.7})`)
            emberGrad.addColorStop(0.6, `hsla(${p.hue + 10}, 85%, 45%, ${glowOpacity * 0.3})`)
            emberGrad.addColorStop(1, 'transparent')
            ctx.fillStyle = emberGrad
            ctx.fillRect(p.x - glowSize, p.y - glowSize, glowSize * 2, glowSize * 2)
          }
          // Hot white core
          ctx.beginPath()
          ctx.arc(p.x, p.y, size * 0.3 * pulse, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${p.hue - 10}, 40%, 92%, 0.95)`
          ctx.fill()

        } else if (p.type === 'sparkle') {
          const twinkle = Math.sin(pulseTime * 0.3 + p.pulsePhase) * 0.5 + 0.5
          const sparkSize = size * twinkle * 2

          // Star cross
          ctx.strokeStyle = `hsla(${p.hue}, 100%, 85%, ${twinkle})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(p.x - sparkSize, p.y)
          ctx.lineTo(p.x + sparkSize, p.y)
          ctx.moveTo(p.x, p.y - sparkSize)
          ctx.lineTo(p.x, p.y + sparkSize)
          ctx.moveTo(p.x - sparkSize * 0.5, p.y - sparkSize * 0.5)
          ctx.lineTo(p.x + sparkSize * 0.5, p.y + sparkSize * 0.5)
          ctx.moveTo(p.x + sparkSize * 0.5, p.y - sparkSize * 0.5)
          ctx.lineTo(p.x - sparkSize * 0.5, p.y + sparkSize * 0.5)
          ctx.stroke()

          // Center glow
          ctx.beginPath()
          ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'
          ctx.fill()

        } else if (p.type === 'dust') {
          ctx.globalAlpha *= 0.6
          ctx.beginPath()
          ctx.arc(p.x, p.y, size * pulse, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${p.hue}, 50%, ${lightness + 20}%, 0.8)`
          ctx.fill()

        } else if (p.type === 'wisp') {
          // Ethereal wisp with purple hue
          const wispGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 4)
          wispGrad.addColorStop(0, `hsla(${p.hue}, 80%, 70%, 0.5)`)
          wispGrad.addColorStop(0.4, `hsla(${p.hue}, 70%, 55%, 0.2)`)
          wispGrad.addColorStop(1, 'transparent')
          ctx.fillStyle = wispGrad
          ctx.fillRect(p.x - size * 4, p.y - size * 4, size * 8, size * 8)

          ctx.beginPath()
          ctx.arc(p.x, p.y, size * 0.5 * pulse, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${p.hue}, 60%, 85%, 0.9)`
          ctx.fill()

        } else if (p.type === 'ring') {
          ctx.strokeStyle = `hsla(${p.hue}, ${saturation}%, ${lightness}%, ${p.opacity * 0.7})`
          ctx.lineWidth = size * 0.5
          ctx.beginPath()
          ctx.arc(p.x, p.y, size * 2 * pulse, 0, Math.PI * 2)
          ctx.stroke()

        } else {
          // Core particle - rich glow
          const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 4)
          glowGrad.addColorStop(0, `hsla(${p.hue}, ${saturation}%, ${lightness + 15}%, 0.9)`)
          glowGrad.addColorStop(0.2, `hsla(${p.hue}, ${saturation}%, ${lightness}%, 0.5)`)
          glowGrad.addColorStop(0.5, `hsla(${p.hue + 5}, ${saturation - 10}%, ${lightness - 10}%, 0.15)`)
          glowGrad.addColorStop(1, 'transparent')
          ctx.fillStyle = glowGrad
          ctx.fillRect(p.x - size * 4, p.y - size * 4, size * 8, size * 8)

          // Solid core with 3D highlight
          ctx.beginPath()
          ctx.arc(p.x, p.y, size * pulse, 0, Math.PI * 2)
          const coreGrad = ctx.createRadialGradient(
            p.x - size * 0.3, p.y - size * 0.3, 0,
            p.x, p.y, size
          )
          coreGrad.addColorStop(0, `hsla(${p.hue - 5}, 50%, 90%, 1)`)
          coreGrad.addColorStop(0.4, `hsla(${p.hue}, ${saturation}%, ${lightness}%, 1)`)
          coreGrad.addColorStop(1, `hsla(${p.hue + 8}, ${saturation + 10}%, ${lightness - 15}%, 1)`)
          ctx.fillStyle = coreGrad
          ctx.fill()
        }

        ctx.restore()
      }

      // Burst effects
      if (burstRadius > 0) {
        ctx.save()

        // Multiple shockwave rings
        for (let i = 0; i < 4; i++) {
          const ringRadius = burstRadius * (0.6 + i * 0.15)
          const ringOpacity = (1 - burstProgress) * (0.6 - i * 0.1)
          const ringHue = i % 2 === 0 ? 28 : 300

          ctx.globalAlpha = ringOpacity
          ctx.strokeStyle = `hsl(${ringHue}, 80%, 65%)`
          ctx.lineWidth = 3 - i * 0.5
          ctx.shadowColor = `hsl(${ringHue}, 100%, 60%)`
          ctx.shadowBlur = 15
          ctx.beginPath()
          ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.shadowBlur = 0

        // Central flash
        if (burstProgress < 0.3) {
          const flashOpacity = (0.3 - burstProgress) / 0.3
          const flashGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 180)
          flashGrad.addColorStop(0, `rgba(255, 255, 255, ${flashOpacity * 0.95})`)
          flashGrad.addColorStop(0.2, `rgba(255, 220, 180, ${flashOpacity * 0.7})`)
          flashGrad.addColorStop(0.5, `rgba(204, 120, 92, ${flashOpacity * 0.3})`)
          flashGrad.addColorStop(1, 'transparent')
          ctx.fillStyle = flashGrad
          ctx.fillRect(0, 0, width, height)
        }

        ctx.restore()
      }

      ctx.restore() // End shake transform

      if (elapsed < totalDuration + 500) {
        animationId = requestAnimationFrame(animate)
      }
    }

    function easeOutQuart(x: number): number {
      return 1 - Math.pow(1 - x, 4)
    }

    animate()

    const completeTimer = setTimeout(() => onComplete(), totalDuration + 500)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <div className={`fixed inset-0 z-50 bg-[#020104] transition-opacity duration-500 ${phase === 'fadeout' ? 'opacity-0' : 'opacity-100'}`}>
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Logo reveal */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className={`transition-all duration-700 ease-out ${
          phase === 'burst' || phase === 'fadeout'
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-90 translate-y-6'
        }`}>
          <h1 className="text-5xl font-bold tracking-tight mb-1">
            <span className="text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">Claude</span>
            <span className="bg-gradient-to-r from-[#cc785c] via-[#e8956e] to-[#cc785c] bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(204,120,92,0.5)]">Code</span>
            <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 bg-clip-text text-transparent ml-3 drop-shadow-[0_0_30px_rgba(168,85,247,0.4)]">Arena</span>
          </h1>
        </div>

        {/* Progress ring */}
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.06)" strokeWidth="3" fill="none" />
                <circle
                  cx="32" cy="32" r="28"
                  stroke="url(#progressGrad)"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 1.76} 176`}
                  style={{ filter: 'drop-shadow(0 0 10px rgba(204, 120, 92, 0.6))' }}
                />
                <defs>
                  <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#cc785c" />
                    <stop offset="50%" stopColor="#e8956e" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-mono text-white/80">{progress}%</span>
              </div>
            </div>

            <p className={`text-xs font-medium transition-all duration-300 ${
              phase === 'burst' || phase === 'fadeout' ? 'text-emerald-400'
                : phase === 'spinning' ? 'text-[#e8956e]'
                : 'text-gray-500'
            }`}>
              {phase === 'burst' || phase === 'fadeout' ? 'Ready' : phase === 'spinning' ? 'Loading...' : 'Initializing'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
