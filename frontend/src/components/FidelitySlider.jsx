import { Info } from 'lucide-react'

/**
 * FidelitySlider
 * Exposes the CodeFormer 'w' parameter.
 * High values → preserve original face structure (forensic default 0.85).
 * Low  values → allow more AI reconstruction (risk of hallucination).
 */
export default function FidelitySlider({ value, onChange }) {
  const pct = Math.round(value * 100)

  const getLabel = () => {
    if (value >= 0.8) return { text: 'Max Fidelity', color: 'text-emerald-400' }
    if (value >= 0.6) return { text: 'Balanced',     color: 'text-yellow-400' }
    return               { text: 'High Restoration', color: 'text-orange-400' }
  }

  const { text, color } = getLabel()

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white/90">
            AI Fidelity Control
          </h3>
          <p className="mt-0.5 text-xs text-white/40">
            CodeFormer <span className="font-mono text-forensic-400">w</span> parameter
          </p>
        </div>
        {/* Current value badge */}
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-xl font-bold text-forensic-400">
            {value.toFixed(2)}
          </span>
          <span className={`text-xs font-medium ${color}`}>{text}</span>
        </div>
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <input
          type="range"
          id="fidelity-slider"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full accent-forensic-500"
          aria-label="CodeFormer fidelity weight"
        />
        {/* Scale labels */}
        <div className="flex justify-between text-xs text-white/30">
          <span>0.0 — AI Hallucination</span>
          <span>1.0 — Pure Original</span>
        </div>
      </div>

      {/* Warning tooltip */}
      <div className="flex items-start gap-2 rounded-xl bg-forensic-500/5 border border-forensic-500/10 p-3">
        <Info size={14} className="mt-0.5 shrink-0 text-forensic-400" />
        <p className="text-xs text-white/50 leading-relaxed">
          <span className="text-white/70 font-medium">Forensic mode: </span>
          Values ≥ 0.80 ensure the AI sharpens edges only and never reconstructs
          or hallucinate facial features — required for legal admissibility.
        </p>
      </div>
    </div>
  )
}
