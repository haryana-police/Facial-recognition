import { ShieldCheck, ShieldX, User, FileText, Hash } from 'lucide-react'

/**
 * ResultCard
 * Displays the top database match (or a "no match" state).
 */
export default function ResultCard({ result }) {
  const { matchFound, similarityScore, suspect, message } = result
  const scorePct = Math.round((similarityScore ?? 0) * 100)

  /* Determine score colour class */
  const scoreClass =
    similarityScore >= 0.8 ? 'score-high'
    : similarityScore >= 0.65 ? 'score-medium'
    : 'score-low'

  /* Radial progress conic-gradient for score ring */
  const conicStyle = {
    background: `conic-gradient(
      ${similarityScore >= 0.8 ? '#10b981' : similarityScore >= 0.65 ? '#eab308' : '#ef4444'}
      ${scorePct * 3.6}deg,
      rgba(255,255,255,0.05) ${scorePct * 3.6}deg
    )`,
  }

  return (
    <div className="glass-card p-5 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        {matchFound ? (
          <ShieldCheck size={20} className="text-emerald-400" />
        ) : (
          <ShieldX size={20} className="text-red-400" />
        )}
        <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50">
          {matchFound ? 'Identity Match Found' : 'No Match in Database'}
        </h2>
      </div>

      {matchFound && suspect ? (
        <div className="space-y-4">
          {/* Score ring + info */}
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Circular score meter */}
            <div className="relative shrink-0">
              <div
                className="h-24 w-24 rounded-full flex items-center justify-center"
                style={conicStyle}
              >
                <div className="h-[80px] w-[80px] rounded-full bg-surface-900 flex flex-col items-center justify-center">
                  <span className="font-mono text-xl font-bold text-white">{scorePct}%</span>
                  <span className="text-[9px] text-white/30 uppercase tracking-wider">Score</span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider">Identified As</p>
                <p className="mt-0.5 text-xl font-bold text-white">{suspect.name}</p>
              </div>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${scoreClass}`}>
                Similarity: {similarityScore?.toFixed(4)}
              </span>
            </div>

            {/* Suspect Photo */}
            {suspect.suspectPhotoUrl && (
              <div className="shrink-0">
                <img
                  src={suspect.suspectPhotoUrl}
                  alt="Suspect matched"
                  className="h-24 w-24 object-cover rounded-xl border border-white/10"
                />
              </div>
            )}
          </div>

          {/* Suspect detail rows */}
          <div className="rounded-xl bg-white/3 border border-white/5 divide-y divide-white/5">
            <DetailRow icon={<Hash size={13}/>}      label="Case ID"  value={`#SUSPECT-${String(suspect.id).padStart(4,'0')}`} />
            <DetailRow icon={<User size={13}/>}       label="Name"    value={suspect.name} />
            <DetailRow icon={<FileText size={13}/>}   label="Details" value={suspect.details} multiline />
          </div>

          {/* Forensic threshold note */}
          <p className="text-xs text-white/25 text-center leading-relaxed">
            Forensic threshold: similarity must strictly exceed 0.60.
            This result cleared the threshold.
          </p>
        </div>
      ) : (
        /* No match state */
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="rounded-full bg-red-500/10 p-4 ring-1 ring-red-500/20">
            <ShieldX size={32} className="text-red-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-white/80">No suspect identified</p>
            <p className="mt-1 text-sm text-white/40">{message}</p>
          </div>
          {similarityScore !== null && similarityScore !== undefined && (
            <span className="score-low rounded-full px-3 py-1 text-xs font-semibold">
              Best score: {similarityScore.toFixed(4)} (below 0.60 threshold)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function DetailRow({ icon, label, value, multiline }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 text-white/30">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-white/30">{label}</p>
        <p className={`mt-0.5 text-sm text-white/80 font-medium ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>
          {value}
        </p>
      </div>
    </div>
  )
}
