import { useState } from 'react'
import { Filter, User, Calendar, Ruler, ChevronDown, X } from 'lucide-react'

/**
 * FilterPanel — Mobile-first
 * Age and Height use From–To range inputs.
 * On mobile: collapsible panel, full-width inputs, large touch targets.
 */
export default function FilterPanel({ filters, onChange }) {
  const [open, setOpen] = useState(false) // closed by default on mobile to save space

  const set = (key, val) => onChange({ ...filters, [key]: val })

  const clearAll = () => onChange({
    gender: '',
    age_from: '',
    age_to: '',
    height_from: '',
    height_to: '',
  })

  const hasActiveFilter =
    filters.gender ||
    filters.age_from || filters.age_to ||
    filters.height_from || filters.height_to

  return (
    <div className="glass-card overflow-hidden">
      {/* Header — always visible, tappable */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-4
                   hover:bg-white/5 active:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forensic-500/20">
            <Filter size={15} className="text-forensic-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Pre-Search Filters</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">
              Step 1 — Narrow the database
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilter && (
            <span className="rounded-full bg-forensic-500/20 border border-forensic-500/30
                             px-2 py-0.5 text-[10px] font-bold text-forensic-400">
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
        <div className="px-4 sm:px-5 pb-5 space-y-5 border-t border-white/5 pt-4">

          {/* Gender */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/40 font-semibold">
              <User size={12} className="text-forensic-400" />
              Gender
            </label>
            {/* Buttons — full width on mobile, wrap nicely */}
            <div className="grid grid-cols-4 gap-2">
              {['Any', 'Male', 'Female', 'Unknown'].map(g => (
                <button
                  key={g}
                  onClick={() => set('gender', g === 'Any' ? '' : g)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200
                    active:scale-95
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

          {/* Age Range */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/40 font-semibold">
              <Calendar size={12} className="text-forensic-400" />
              Age (years)
            </label>
            <div className="flex items-center gap-3">
              <input
                id="filter-age-from"
                type="number"
                inputMode="numeric"
                min="1"
                max="120"
                placeholder="From"
                value={filters.age_from}
                onChange={e => set('age_from', e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3
                           text-sm text-white placeholder:text-white/20
                           focus:outline-none focus:border-forensic-500/60 focus:bg-forensic-500/5
                           transition-all"
              />
              <span className="text-white/30 text-sm font-bold shrink-0">–</span>
              <input
                id="filter-age-to"
                type="number"
                inputMode="numeric"
                min="1"
                max="120"
                placeholder="To"
                value={filters.age_to}
                onChange={e => set('age_to', e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3
                           text-sm text-white placeholder:text-white/20
                           focus:outline-none focus:border-forensic-500/60 focus:bg-forensic-500/5
                           transition-all"
              />
            </div>
            {(filters.age_from || filters.age_to) && (
              <p className="text-[10px] text-forensic-400/70 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-forensic-400 inline-block" />
                Range: {filters.age_from || '?'} – {filters.age_to || '?'} yrs
              </p>
            )}
          </div>

          {/* Height Range */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/40 font-semibold">
              <Ruler size={12} className="text-forensic-400" />
              Height (cm)
            </label>
            <div className="flex items-center gap-3">
              <input
                id="filter-height-from"
                type="number"
                inputMode="numeric"
                min="50"
                max="250"
                placeholder="From"
                value={filters.height_from}
                onChange={e => set('height_from', e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3
                           text-sm text-white placeholder:text-white/20
                           focus:outline-none focus:border-forensic-500/60 focus:bg-forensic-500/5
                           transition-all"
              />
              <span className="text-white/30 text-sm font-bold shrink-0">–</span>
              <input
                id="filter-height-to"
                type="number"
                inputMode="numeric"
                min="50"
                max="250"
                placeholder="To"
                value={filters.height_to}
                onChange={e => set('height_to', e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3
                           text-sm text-white placeholder:text-white/20
                           focus:outline-none focus:border-forensic-500/60 focus:bg-forensic-500/5
                           transition-all"
              />
            </div>
            {(filters.height_from || filters.height_to) && (
              <p className="text-[10px] text-forensic-400/70 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-forensic-400 inline-block" />
                Range: {filters.height_from || '?'} – {filters.height_to || '?'} cm
              </p>
            )}
          </div>

          {/* Clear filters */}
          {hasActiveFilter && (
            <button
              onClick={clearAll}
              className="flex items-center gap-2 text-xs text-red-400/70 hover:text-red-400
                         active:text-red-400 transition-colors py-1"
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
