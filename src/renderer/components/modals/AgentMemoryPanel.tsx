import { useState, useEffect } from 'react'
import { Brain, X, Trash2, Plus, ChevronDown, Sparkles, BookOpen, AlertTriangle, Terminal, Workflow, Zap, RefreshCw } from 'lucide-react'
import { useAgentMemory } from '../../hooks/useAgentMemory'
import { useAppStore } from '../../store'
import type { AgentMemoryEntry, AgentMemoryCategory } from '../../../shared/types'

interface Props {
  onClose: () => void
}

const CATEGORY_META: Record<AgentMemoryCategory, { label: string; icon: React.ElementType; color: string; description: string }> = {
  command: { label: 'Commands', icon: Terminal, color: 'emerald', description: 'Specific commands that work in this project' },
  preference: { label: 'Preferences', icon: Zap, color: 'blue', description: 'Code style and architectural choices' },
  pattern: { label: 'Patterns', icon: BookOpen, color: 'purple', description: 'Recurring structures discovered in the codebase' },
  failure: { label: 'Avoid', icon: AlertTriangle, color: 'red', description: 'Things that failed and should not be repeated' },
  workflow: { label: 'Workflow', icon: Workflow, color: 'yellow', description: 'Step sequences that reliably work' }
}

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as AgentMemoryCategory[]

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color = confidence >= 0.85 ? 'bg-emerald-400' : confidence >= 0.7 ? 'bg-yellow-400' : 'bg-orange-400'
  return (
    <div className="flex items-center gap-1" title={`Confidence: ${Math.round(confidence * 100)}%`}>
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-[10px] text-[#555]">{Math.round(confidence * 100)}%</span>
    </div>
  )
}

function EntryRow({
  entry,
  onDelete
}: {
  entry: AgentMemoryEntry
  onDelete: (id: string) => void
}) {
  const meta = CATEGORY_META[entry.category]
  const Icon = meta.icon

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[#161616] transition-colors">
      <Icon size={12} className={`text-${meta.color}-500 mt-0.5 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#ddd] leading-snug">{entry.content}</p>
        <div className="flex items-center gap-3 mt-1">
          <ConfidenceDot confidence={entry.confidence} />
          <span className="text-[10px] text-[#555]">
            {entry.source === 'auto' ? 'auto-learned' : 'manual'}
            {entry.sessionCount > 1 ? ` · ${entry.sessionCount} sessions` : ''}
          </span>
        </div>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-950 rounded transition-all flex-shrink-0"
        title="Delete entry"
      >
        <Trash2 size={11} className="text-red-500" />
      </button>
    </div>
  )
}

export default function AgentMemoryPanel({ onClose }: Props) {
  const cwd = useAppStore((s) => s.cwd)
  const { memories, loadForProject, deleteEntry, clearProjectMemory, addManualEntry } = useAgentMemory()

  const [isLoading, setIsLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<AgentMemoryCategory | 'all'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState<AgentMemoryCategory>('command')
  const [isSaving, setIsSaving] = useState(false)

  const record = memories.get(cwd)
  const entries = record?.entries ?? []

  const filteredEntries =
    activeCategory === 'all' ? entries : entries.filter((e) => e.category === activeCategory)

  // Load on mount / when cwd changes
  useEffect(() => {
    if (!cwd) return
    setIsLoading(true)
    loadForProject(cwd).finally(() => setIsLoading(false))
  }, [cwd, loadForProject])

  const handleRefresh = async () => {
    setIsLoading(true)
    await loadForProject(cwd)
    setIsLoading(false)
  }

  const handleDelete = async (entryId: string) => {
    await deleteEntry(cwd, entryId)
  }

  const handleClearAll = async () => {
    if (!window.confirm('Clear all agent memory for this project? This cannot be undone.')) return
    await clearProjectMemory(cwd)
  }

  const handleAddEntry = async () => {
    if (!newContent.trim()) return
    setIsSaving(true)
    await addManualEntry(cwd, {
      category: newCategory,
      content: newContent.trim().slice(0, 200),
      confidence: 0.9,
      sessionCount: 1,
      source: 'manual'
    })
    setNewContent('')
    setShowAddForm(false)
    setIsSaving(false)
  }

  const countByCategory = (cat: AgentMemoryCategory) =>
    entries.filter((e) => e.category === cat).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e] bg-[#111]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
              <Brain size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Agent Memory</h2>
              <p className="text-[#555] text-xs truncate max-w-xs">{cwd || 'No project'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#555]">{entries.length} entries</span>
            <button onClick={handleRefresh} className="p-1.5 hover:bg-[#1e1e1e] rounded-lg transition-colors" title="Refresh">
              <RefreshCw size={13} className={`text-[#666] ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-[#1e1e1e] rounded-lg transition-colors">
              <X size={16} className="text-[#666]" />
            </button>
          </div>
        </div>

        {/* Explanation banner */}
        <div className="px-5 py-3 bg-violet-950/20 border-b border-violet-900/30 flex items-start gap-2.5">
          <Sparkles size={13} className="text-violet-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-violet-300/80 leading-relaxed">
            The agent automatically learns from each session and injects these memories as context at the start of every new session — so it gets smarter about <strong>your project</strong> over time.
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 px-4 py-2.5 border-b border-[#1e1e1e] overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
              ${activeCategory === 'all' ? 'bg-[#222] text-white' : 'text-[#555] hover:text-[#888]'}`}
          >
            All ({entries.length})
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat]
            const Icon = meta.icon
            const count = countByCategory(cat)
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
                  ${activeCategory === cat
                    ? `bg-${meta.color}-950/60 text-${meta.color}-300 border border-${meta.color}-800/50`
                    : 'text-[#555] hover:text-[#888]'
                  }`}
              >
                <Icon size={10} />
                {meta.label} {count > 0 && <span className="opacity-60">({count})</span>}
              </button>
            )
          })}
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-[#444] text-sm">
              Loading memory...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Brain size={24} className="text-[#2a2a2a]" />
              <p className="text-[#444] text-sm">
                {entries.length === 0
                  ? 'No memories yet — run a Super Agent session to start learning'
                  : 'No entries in this category'}
              </p>
            </div>
          ) : (
            filteredEntries
              .sort((a, b) => b.confidence - a.confidence)
              .map((entry) => (
                <EntryRow key={entry.id} entry={entry} onDelete={handleDelete} />
              ))
          )}
        </div>

        {/* Add entry form */}
        {showAddForm && (
          <div className="border-t border-[#1e1e1e] px-4 py-3 space-y-3 bg-[#0a0a0a]">
            <div className="flex gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as AgentMemoryCategory)}
                className="bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-600"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_META[cat].label}</option>
                ))}
              </select>
              <input
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddEntry() }}
                placeholder="Enter what the agent should remember..."
                className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-violet-600"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddEntry}
                disabled={!newContent.trim() || isSaving}
                className="px-4 py-1.5 rounded-lg bg-violet-700 text-white text-xs font-semibold disabled:opacity-40 hover:bg-violet-600 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewContent('') }}
                className="px-4 py-1.5 rounded-lg bg-[#1a1a1a] text-[#888] text-xs hover:bg-[#222] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e1e1e] bg-[#0a0a0a]">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-950/50 border border-violet-800/50 text-violet-300 text-xs font-semibold hover:bg-violet-900/50 transition-all"
          >
            <Plus size={12} />
            Add Memory
          </button>
          {entries.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#555] text-xs hover:text-red-400 hover:bg-red-950/30 transition-all"
            >
              <Trash2 size={12} />
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
