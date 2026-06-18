import { useState } from 'react'
import {
  ShieldCheck, ShieldX, User, Hash, MapPin, Calendar,
  Ruler, ChevronDown, ChevronUp, FileText, AlertCircle
} from 'lucide-react'

/**
 * ResultCard
 * Shows top 5 matches with full suspect metadata.
 */
export default function ResultCard({ result }) {
  const { matchFound, message, topMatches, filteredCount } = result

  return (
    <div className="glass-card p-5 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {matchFound ? (
            <ShieldCheck size={20} className="text-emerald-400" />
          ) : (
            <ShieldX size={20} className="text-red-400" />
          )}
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50">
            {matchFound ? 'Top Identity Matches' : 'No Match in Database'}
          </h2>
        </div>
        {typeof filteredCount === 'number' && (
          <span className="text-[10px] text-white/30 bg-white/5 px-3 py-1 rounded-full">
            {filteredCount} suspects scanned
          </span>
        )}
      </div>

      {topMatches && topMatches.length > 0 ? (
        <div className="space-y-3">
          {topMatches.map((match, idx) => (
            <MatchRow key={idx} match={match} rank={idx + 1} />
          ))}
          <p className="text-[10px] text-white/25 text-center leading-relaxed pt-1">
            Forensic threshold: similarity must exceed 0.60 for a confirmed match.
          </p>
        </div>
      ) : (
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

// ─── Single Match Row ─────────────────────────────────────────────────────────
function MatchRow({ match, rank }) {
  const [expanded, setExpanded] = useState(rank === 1)

  const scorePct   = Math.round((match.similarityScore ?? 0) * 100)
  const isConfirmed = match.similarityScore >= 0.60
  const scoreClass  =
    match.similarityScore >= 0.80 ? 'score-high'
    : match.similarityScore >= 0.60 ? 'score-medium'
    : 'score-low'

  const borderClass = rank === 1 && isConfirmed
    ? 'border-emerald-500/40 bg-emerald-500/5'
    : 'border-white/10 bg-white/3'

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${borderClass}`}>
      {/* Collapsed Row — always visible */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Rank badge */}
        <span className="shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/40 font-bold">
          {rank}
        </span>

        {/* Photo */}
        <div className="shrink-0">
          {match.suspectPhotoUrl ? (
            <img
              src={match.suspectPhotoUrl}
              alt={`Suspect ${rank}`}
              className="h-14 w-14 object-cover rounded-xl border border-white/10"
            />
          ) : (
            <div className="h-14 w-14 bg-black/40 rounded-xl flex items-center justify-center border border-white/10">
              <User size={22} className="text-white/20" />
            </div>
          )}
        </div>

        {/* Name + DD No */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{match.name || 'Unknown'}</p>
          {match.dd_no && (
            <p className="text-[10px] text-white/40 mt-0.5 font-mono truncate">DD: {match.dd_no}</p>
          )}
          {match.found_district && (
            <p className="text-[10px] text-white/30 truncate">{match.found_district}</p>
          )}
        </div>

        {/* Score + expand icon */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${scoreClass}`}>
            {scorePct}% Match
          </span>
          {expanded
            ? <ChevronUp size={13} className="text-white/30" />
            : <ChevronDown size={13} className="text-white/30" />
          }
        </div>
      </div>

      {/* Expanded Detail Panel */}
      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 grid grid-cols-2 gap-x-4 gap-y-2">

          {/* Physical Attributes */}
          <MetaBlock icon={<Ruler size={12}/>} label="Height" value={
            match.height_cm > 0 ? `${match.height_cm} cm` : '—'
          }/>
          <MetaBlock icon={<User size={12}/>} label="Gender" value={match.gender || '—'} />
          <MetaBlock label="Age Range" value={
            (match.age_min > 0 || match.age_max > 0)
              ? `${match.age_min || '?'} – ${match.age_max || '?'} yrs`
              : '—'
          }/>
          <MetaBlock label="Build" value={match.build || '—'} />
          <MetaBlock label="Skin Tone" value={match.skin_tone || '—'} />
          <MetaBlock label="Hair Color" value={match.hair_color || '—'} />
          <MetaBlock label="Beard" value={match.beard || '—'} />

          {/* Location Info */}
          <MetaBlock icon={<MapPin size={12}/>} label="Found District" value={match.found_district || '—'} />
          <MetaBlock label="Police Station" value={match.ps_name || '—'} />
          <MetaBlock icon={<Calendar size={12}/>} label="Found Date" value={match.found_date || '—'} />

          {/* Full-width fields */}
          {match.found_loc && (
            <MetaBlock label="Found Location" value={match.found_loc} wide />
          )}
          {match.visible_marks && (
            <MetaBlock icon={<AlertCircle size={12}/>} label="Visible Marks" value={match.visible_marks} wide />
          )}
          {match.clothing_description && (
            <MetaBlock label="Clothing" value={match.clothing_description} wide />
          )}
          {match.notes && (
            <MetaBlock icon={<FileText size={12}/>} label="Notes" value={match.notes} wide />
          )}

          {/* Similarity score detail */}
          <div className="col-span-2 mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Cosine Similarity</span>
            <span className="text-[10px] font-mono text-white/50">{match.similarityScore?.toFixed(6)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tiny metadata cell ───────────────────────────────────────────────────────
function MetaBlock({ icon, label, value, wide }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/25 mb-0.5">
        {icon && <span className="text-forensic-400/60">{icon}</span>}
        {label}
      </p>
      <p className={`text-xs text-white/70 font-medium ${wide ? 'leading-relaxed' : 'truncate'}`}>
        {value || '—'}
      </p>
    </div>
  )
}
