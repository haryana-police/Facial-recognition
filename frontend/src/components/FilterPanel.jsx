import { useState } from 'react'
import { Filter, User, Calendar, Ruler, ChevronDown, X } from 'lucide-react'

/**
 * FilterPanel
 * Step 1 of the search flow — narrow results by gender, age, height
 * before doing face matching.
 */
export default function FilterPanel({ filters, onChange }) {
  const [open, setOpen] = useState(true)

  const set = (key, val) => onChange({ ...filters, [key]: val })
  const clearAll = () => onChange({ gender: '', age: '', height_cm: '' })

  const hasActiveFilter = filters.gender || filters.age || filters.height_cm

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forensic-500/20">
            <Filter size={15} className="text-forensic-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Pre-Search Filters</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">
              Step 1 — Narrow the database before face matching
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilter && (
            <span className="rounded-full bg-forensic-500/20 border border-forensic-500/30 px-2 py-0.5 text-[10px] font-bold text-forensic-400">
              ACTIVE
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-white/40 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Filter Body */}
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">

          {/* Gender */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/40 font-semibold">
              <User size={12} className="text-forensic-400" />
              Gender
            </label>
            <div className="flex gap-2 flex-wrap">
              {['Any', 'Male', 'Female', 'Unknown'].map(g => (
                <button
                  key={g}
                  onClick={() => set('gender', g === 'Any' ? '' : g)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200
                    ${(g === 'Any' && !filters.gender) || filters.gender === g
                      ? 'bg-forensic-500/30 border-forensic-500/60 text-forensic-300'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
                    }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Age + Height — side by side */}
          <div className="grid grid-cols-2 gap-4">

            {/* Age */}
            <div className="space-y-2">
              <label
                htmlFor="filter-age"
                className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/40 font-semibold"
              >
                <Calendar size={12} className="text-forensic-400" />
                Age (years)
              </label>
              <div className="relative">
                <input
                  id="filter-age"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="e.g. 28"
                  value={filters.age}
                  onChange={e => set('age', e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5
                             text-sm text-white placeholder:text-white/20
                             focus:outline-none focus:border-forensic-500/60 focus:bg-forensic-500/5
                             transition-all"
                />
                {filters.age && (
                  <p className="mt-1 text-[10px] text-forensic-400/70">
                    Range: {Math.max(1, parseInt(filters.age) - 5)} – {parseInt(filters.age) + 5} yrs
                  </p>
                )}
              </div>
            </div>

            {/* Height */}
            <div className="space-y-2">
              <label
                htmlFor="filter-height"
                className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/40 font-semibold"
              >
                <Ruler size={12} className="text-forensic-400" />
                Height (cm)
              </label>
              <div className="relative">
                <input
                  id="filter-height"
                  type="number"
                  min="50"
                  max="250"
                  placeholder="e.g. 170"
                  value={filters.height_cm}
                  onChange={e => set('height_cm', e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5
                             text-sm text-white placeholder:text-white/20
                             focus:outline-none focus:border-forensic-500/60 focus:bg-forensic-500/5
                             transition-all"
                />
                {filters.height_cm && (
                  <p className="mt-1 text-[10px] text-forensic-400/70">
                    Range: {Math.max(1, parseFloat(filters.height_cm) - 5)} – {parseFloat(filters.height_cm) + 5} cm
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Clear filters */}
          {hasActiveFilter && (
            <button
              onClick={clearAll}
              className="flex items-center gap-2 text-xs text-red-400/70 hover:text-red-400 transition-colors"
            >
              <X size={12} />
              Clear all filters
            </button>
          )}

          {/* Info note */}
          <p className="text-[10px] text-white/20 leading-relaxed">
            Note: Suspects with unknown age (0) or height (0) are always included regardless of filters.
          </p>
        </div>
      )}
    </div>
  )
}
