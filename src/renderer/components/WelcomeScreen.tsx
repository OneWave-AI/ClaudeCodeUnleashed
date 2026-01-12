import { useState, useEffect } from 'react'
import {
  Sparkles,
  Terminal,
  Globe,
  Palette,
  Zap,
  ArrowRight,
  X,
  Check,
  GripVertical,
  SplitSquareVertical
} from 'lucide-react'

interface WelcomeScreenProps {
  onComplete: () => void
}

const APP_VERSION = '2.1.0'
const LAST_SEEN_KEY = 'claudeCodeArena_lastSeenVersion'

// Updates for this version
const UPDATES = [
  {
    icon: SplitSquareVertical,
    title: 'Split Panels',
    description: 'Drag tabs to create side-by-side terminal and browser panels'
  },
  {
    icon: Globe,
    title: 'Built-in Browser',
    description: 'Add browser tabs with the + menu for quick web access'
  },
  {
    icon: Palette,
    title: 'Custom Themes',
    description: 'Create and apply custom terminal color themes'
  },
  {
    icon: Zap,
    title: 'Super Agent',
    description: 'AI-powered autonomous task completion with external LLMs'
  }
]

// Quick tips for new users
const TIPS = [
  {
    icon: Terminal,
    title: 'Terminal',
    tip: 'Click + to add terminals or browsers'
  },
  {
    icon: GripVertical,
    title: 'Drag & Drop',
    tip: 'Drag tabs to reorder or create split panels'
  },
  {
    icon: Palette,
    title: 'Customize',
    tip: 'Open Settings to change themes and fonts'
  }
]

export default function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [isFirstTime, setIsFirstTime] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY)

    // Determine if we should show the welcome screen
    if (!lastSeen) {
      // First time user
      setIsFirstTime(true)
      setVisible(true)
    } else if (lastSeen !== APP_VERSION) {
      // Returning user with updates
      setIsFirstTime(false)
      setVisible(true)
    } else {
      // No updates to show
      onComplete()
    }
  }, [onComplete])

  const handleDismiss = () => {
    localStorage.setItem(LAST_SEEN_KEY, APP_VERSION)
    setVisible(false)
    setTimeout(onComplete, 300)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg mx-4 bg-[#141414] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#cc785c] via-[#e8956e] to-purple-500" />

        {/* Skip button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#cc785c]/20 to-purple-500/20">
              <Sparkles className="w-6 h-6 text-[#cc785c]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {isFirstTime ? 'Welcome to Claude Code Arena' : "What's New"}
              </h2>
              <p className="text-sm text-gray-500">
                {isFirstTime ? 'Get started in seconds' : `Version ${APP_VERSION}`}
              </p>
            </div>
          </div>

          {/* Content based on type */}
          {isFirstTime ? (
            // First time user - show quick tips
            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-400 mb-4">
                Claude Code Arena is a powerful terminal interface for Claude AI.
              </p>
              {TIPS.map((tip, index) => (
                <div
                  key={tip.title}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="p-2 rounded-lg bg-[#cc785c]/10">
                    <tip.icon size={16} className="text-[#cc785c]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{tip.title}</p>
                    <p className="text-xs text-gray-500">{tip.tip}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Returning user - show updates
            <div className="space-y-3 mb-6">
              {UPDATES.map((update, index) => (
                <div
                  key={update.title}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="p-2 rounded-lg bg-[#cc785c]/10 mt-0.5">
                    <update.icon size={16} className="text-[#cc785c]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{update.title}</p>
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded">
                        NEW
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{update.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action button */}
          <button
            onClick={handleDismiss}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#cc785c] to-[#e8956e] text-white font-medium hover:opacity-90 transition-opacity"
          >
            <span>{isFirstTime ? 'Get Started' : 'Got It'}</span>
            <ArrowRight size={16} />
          </button>

          {/* Keyboard hint */}
          <p className="text-center text-[10px] text-gray-600 mt-3">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500">Esc</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500">Enter</kbd> to continue
          </p>
        </div>
      </div>
    </div>
  )
}
