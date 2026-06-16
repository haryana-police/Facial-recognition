import { ShieldCheck, ShieldX, User, FileText, Hash } from 'lucide-react'

/**
 * ResultCard
 * Displays the top database match (or a "no match" state).
 */
export default function ResultCard({ result }) {
  const { matchFound, similarityScore, suspect, message, topMatches } = result

  return (
    <div className="glass-card p-5 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {matchFound ? (
          <ShieldCheck size={20} className="text-emerald-400" />
        ) : (
          <ShieldX size={20} className="text-red-400" />
        )}
        <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50">
          {matchFound ? 'Top Identity Matches' : 'No Match in Database'}
        </h2>
      </div>

      {topMatches && topMatches.length > 0 ? (
        <div className="space-y-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Top 5 Matches</p>
          <div className="grid grid-cols-1 gap-3">
            {topMatches.map((match, idx) => {
              const scorePct = Math.round((match.similarityScore ?? 0) * 100)
              const scoreClass =
                match.similarityScore >= 0.8 ? 'score-high'
                : match.similarityScore >= 0.65 ? 'score-medium'
                : 'score-low'
              
              const isPrimaryMatch = idx === 0 && match.similarityScore > 0.60;

              return (
                <div key={idx} className={`flex items-center gap-4 p-3 rounded-xl border ${isPrimaryMatch ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
                  {/* Photo */}
                  <div className="shrink-0">
                    {match.suspectPhotoUrl ? (
                      <img
                        src={match.suspectPhotoUrl}
                        alt="Match"
                        className="h-16 w-16 object-cover rounded-lg border border-white/10"
                      />
                    ) : (
                      <div className="h-16 w-16 bg-black/40 rounded-lg flex items-center justify-center border border-white/10">
                        <User size={24} className="text-white/20"/>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{match.name}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">ID: #{match.id}</p>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 flex flex-col items-end">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${scoreClass}`}>
                      {scorePct}% Match
                    </span>
                    <span className="text-[10px] text-white/30 mt-1">
                      {match.similarityScore.toFixed(4)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Forensic threshold note */}
          <p className="text-[10px] text-white/25 text-center leading-relaxed mt-4">
            Forensic threshold: similarity must strictly exceed 0.60 for a confirmed match.
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
