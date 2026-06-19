/**
 * ImageComparison
 * Desktop: side-by-side (Original | Enhanced)
 * Mobile : stacked vertically
 */
export default function ImageComparison({ originalUrl, enhancedUrl }) {
  return (
    <div className="glass-card p-5 space-y-4 animate-fade-in">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40">
        Image Analysis
      </h2>

      {/* Responsive grid: 1 col on mobile → 2 cols on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Original */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white/30" />
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Original Frame
            </span>
          </div>
          <div className="overflow-hidden rounded-xl bg-black/40 border border-white/5">
            <img
              src={originalUrl}
              alt="Original camera photo"
              className="w-full h-56 object-contain"
            />
          </div>
        </div>

        {/* Enhanced */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-forensic-500 animate-pulse" />
            <span className="text-xs font-medium text-forensic-400 uppercase tracking-wider">
              AI Enhanced (Stage 1)
            </span>
          </div>
          <div className="overflow-hidden rounded-xl bg-black/40 border border-forensic-500/20">
            {enhancedUrl ? (
              <img
                src={enhancedUrl}
                alt="AI enhanced face"
                className="w-full h-56 object-contain"
              />
            ) : (
              <div className="flex h-56 items-center justify-center text-white/20 text-sm">
                Processing…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
