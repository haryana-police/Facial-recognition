import { useState, useEffect } from 'react'
import {
  ShieldCheck, ShieldX, User, MapPin, Calendar,
  Ruler, FileText, AlertCircle, X, ExternalLink,
  Hash, Building2, ChevronRight
} from 'lucide-react'

/**
 * ResultCard
 * Shows top 5 matches as tappable cards.
 * Tapping any card opens a full-screen detail modal/drawer.
 */
export default function ResultCard({ result }) {
  const { matchFound, message, topMatches, filteredCount } = result
  const [selectedMatch, setSelectedMatch] = useState(null)

  return (
    <>
      <div className="glass-card p-4 sm:p-5 space-y-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {matchFound ? (
              <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
            ) : (
              <ShieldX size={20} className="text-red-400 shrink-0" />
            )}
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50">
              {matchFound ? 'Top Identity Matches' : 'No Match Found'}
            </h2>
          </div>
          {typeof filteredCount === 'number' && (
            <span className="text-[10px] text-white/30 bg-white/5 px-2.5 py-1 rounded-full shrink-0">
              {filteredCount} scanned
            </span>
          )}
        </div>

        {topMatches && topMatches.length > 0 ? (
          <div className="space-y-2.5">
            {topMatches.map((match, idx) => (
              <MatchRow
                key={idx}
                match={match}
                rank={idx + 1}
                onTap={() => setSelectedMatch(match)}
              />
            ))}
            <p className="text-[10px] text-white/25 text-center leading-relaxed pt-1">
              Forensic threshold: similarity must exceed 0.60 for a confirmed match.
              Tap any row to see full details.
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

      {/* Detail Modal/Drawer */}
      {selectedMatch && (
        <SuspectDetailModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </>
  )
}

// ─── Clickable Match Row ───────────────────────────────────────────────────────
function MatchRow({ match, rank, onTap }) {
  const scorePct    = Math.round((match.similarityScore ?? 0) * 100)
  const isConfirmed = match.similarityScore >= 0.60
  const scoreClass  =
    match.similarityScore >= 0.80 ? 'score-high'
    : match.similarityScore >= 0.60 ? 'score-medium'
    : 'score-low'

  const borderClass = rank === 1 && isConfirmed
    ? 'border-emerald-500/40 bg-emerald-500/5'
    : 'border-white/10 bg-white/[0.03]'

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-200
                  cursor-pointer hover:bg-white/5 active:scale-[0.98]
                  hover:border-forensic-500/40 ${borderClass}`}
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onTap()}
      aria-label={`View details of suspect ${match.name || 'Unknown'}`}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Rank badge */}
        <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center
                         text-[11px] text-white/40 font-bold">
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

        {/* Name + DD No + District */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{match.name || 'Unknown'}</p>
          {match.dd_no && (
            <p className="text-[10px] text-white/40 mt-0.5 font-mono truncate">DD: {match.dd_no}</p>
          )}
          {match.found_district && (
            <p className="text-[10px] text-white/30 truncate">{match.found_district}</p>
          )}
        </div>

        {/* Score + tap hint */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${scoreClass}`}>
            {scorePct}% Match
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-white/25">
            Details <ChevronRight size={11} />
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Full Detail Modal / Bottom Sheet ─────────────────────────────────────────
function SuspectDetailModal({ match, onClose }) {
  const scorePct    = Math.round((match.similarityScore ?? 0) * 100)
  const isConfirmed = match.similarityScore >= 0.60
  const scoreClass  =
    match.similarityScore >= 0.80 ? 'score-high'
    : match.similarityScore >= 0.60 ? 'score-medium'
    : 'score-low'

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    // Prevent body scroll while modal open
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center
                 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Modal Panel — bottom sheet on mobile, centered on desktop */}
      <div
        className="relative w-full sm:max-w-lg bg-surface-950 border border-white/10
                   rounded-t-3xl sm:rounded-2xl overflow-hidden
                   max-h-[90vh] sm:max-h-[85vh] flex flex-col
                   animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            {isConfirmed ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/30">
                <ShieldCheck size={18} className="text-emerald-400" />
              </div>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/20">
                <ShieldX size={18} className="text-red-400" />
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-white">
                {match.name || 'Unknown Suspect'}
              </p>
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${scoreClass}`}>
                {scorePct}% Match
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl
                       bg-white/5 hover:bg-white/10 active:bg-white/15
                       border border-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={16} className="text-white/60" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

          {/* Photo */}
          {match.suspectPhotoUrl && (
            <div className="flex justify-center">
              <img
                src={match.suspectPhotoUrl}
                alt="Suspect photo"
                className="max-h-56 rounded-2xl object-contain border border-white/10 shadow-lg"
              />
            </div>
          )}

          {/* Cosine similarity bar */}
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40 uppercase tracking-wider">AI Match Score</span>
              <span className={`font-bold font-mono ${isConfirmed ? 'text-emerald-400' : 'text-red-400'}`}>
                {match.similarityScore?.toFixed(4)}
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${
                  isConfirmed ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-red-600 to-red-400'
                }`}
                style={{ width: `${Math.min(scorePct, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-white/25">
              {isConfirmed ? '✓ Above forensic threshold (0.60)' : '✗ Below forensic threshold (0.60)'}
            </p>
          </div>

          {/* Identification Info */}
          <Section title="Identification" icon={<Hash size={14} />}>
            <InfoRow label="DD Number"      value={match.dd_no} mono />
            <InfoRow label="Found Date"     value={match.found_date} />
            <InfoRow label="Database ID"    value={`#${match.id}`} mono />
          </Section>

          {/* Physical Description */}
          <Section title="Physical Description" icon={<User size={14} />}>
            <InfoRow label="Gender"         value={match.gender} />
            <InfoRow label="Age Range"      value={
              (match.age_min > 0 || match.age_max > 0)
                ? `${match.age_min || '?'} – ${match.age_max || '?'} years`
                : null
            } />
            <InfoRow label="Height"         value={match.height_cm > 0 ? `${match.height_cm} cm` : null} />
            <InfoRow label="Build"          value={match.build} />
            <InfoRow label="Skin Tone"      value={match.skin_tone} />
            <InfoRow label="Hair Color"     value={match.hair_color} />
            <InfoRow label="Beard"          value={match.beard} />
            {match.visible_marks && (
              <InfoRow label="Visible Marks"  value={match.visible_marks} full />
            )}
            {match.clothing_description && (
              <InfoRow label="Clothing"       value={match.clothing_description} full />
            )}
          </Section>

          {/* Location Info */}
          <Section title="Found Location" icon={<MapPin size={14} />}>
            <InfoRow label="District"       value={match.found_district} />
            <InfoRow label="Police Station" value={match.ps_name} />
            {match.found_loc && (
              <InfoRow label="Location"     value={match.found_loc} full />
            )}
          </Section>

          {/* Notes */}
          {match.notes && (
            <Section title="Notes" icon={<FileText size={14} />}>
              <InfoRow label="Notes" value={match.notes} full />
            </Section>
          )}

        </div>

        {/* Footer close button (mobile friendly) */}
        <div className="px-5 py-4 border-t border-white/5 safe-area-pb">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10
                       text-sm font-semibold text-white/60
                       hover:bg-white/10 active:bg-white/15 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon, children }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-forensic-400/70">{icon}</span>
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">{title}</p>
      </div>
      <div className="rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
        {children}
      </div>
    </div>
  )
}

// ─── Single info row in the modal ─────────────────────────────────────────────
function InfoRow({ label, value, mono, full }) {
  if (!value && value !== 0) return null
  return (
    <div className={`flex px-4 py-3 gap-3 bg-white/[0.02] ${full ? 'flex-col' : 'items-start justify-between'}`}>
      <span className="text-[11px] text-white/30 uppercase tracking-wider shrink-0">{label}</span>
      <span className={`text-sm text-white/80 font-medium text-right ${mono ? 'font-mono text-xs' : ''} ${full ? 'text-left leading-relaxed' : 'truncate max-w-[55%]'}`}>
        {value}
      </span>
    </div>
  )
}
