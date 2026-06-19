import { useState, useCallback } from 'react'
import { Scan, Loader2, AlertCircle, Shield, Search, Settings } from 'lucide-react'
import UploadZone from './components/UploadZone'
import FidelitySlider from './components/FidelitySlider'
import ImageComparison from './components/ImageComparison'
import ResultCard from './components/ResultCard'
import FilterPanel from './components/FilterPanel'
import AdminPanel from './components/AdminPanel'
import { analyzeAndMatch } from './api/forensic'

const STATUS = { IDLE: 'IDLE', LOADING: 'LOADING', SUCCESS: 'SUCCESS', ERROR: 'ERROR' }

export default function App() {
  const [activeTab, setActiveTab]   = useState('search') // 'search' | 'admin'
  const [imageFile, setImageFile]   = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fidelityW, setFidelityW]   = useState(0.85)
  const [status, setStatus]         = useState(STATUS.IDLE)
  const [result, setResult]         = useState(null)
  const [errorMsg, setErrorMsg]     = useState('')

  // Pre-search filters
  const [filters, setFilters] = useState({ gender: '', age_from: '', age_to: '', height_from: '', height_to: '' })

  /* When user picks an image file */
  const handleFileSelected = useCallback((file) => {
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setStatus(STATUS.IDLE)
    setResult(null)
    setErrorMsg('')
  }, [])

  /* Main analysis trigger */
  const handleAnalyze = async () => {
    if (!imageFile) return
    setStatus(STATUS.LOADING)
    setResult(null)
    setErrorMsg('')

    try {
      const data = await analyzeAndMatch(imageFile, fidelityW, filters)
      setResult(data)
      setStatus(STATUS.SUCCESS)
    } catch (err) {
      const msg =
        err.response?.data?.message
        || err.response?.data?.error
        || err.response?.data
        || err.message
        || 'An unexpected error occurred.'
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg))
      setStatus(STATUS.ERROR)
    }
  }

  const isLoading = status === STATUS.LOADING

  const activeFilterCount = [filters.gender, filters.age_from, filters.age_to, filters.height_from, filters.height_to].filter(Boolean).length

  return (
    <div className="min-h-screen bg-surface-950 text-white">

      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-surface-950/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-forensic-500/20 ring-1 ring-forensic-500/30">
              <Shield size={16} className="text-forensic-400" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-white">ForensicAI</p>
              <p className="hidden sm:block text-[10px] text-white/30 uppercase tracking-widest">Case Manager</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Switcher */}
            <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
              <button
                id="tab-search"
                onClick={() => setActiveTab('search')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 sm:px-4 sm:py-1.5 text-xs font-semibold transition-all duration-200
                  ${activeTab === 'search'
                    ? 'bg-forensic-500/30 text-forensic-300 shadow'
                    : 'text-white/40 hover:text-white/70'}`}
              >
                <Search size={13} />
                <span>Search</span>
              </button>
              <button
                id="tab-admin"
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 sm:px-4 sm:py-1.5 text-xs font-semibold transition-all duration-200
                  ${activeTab === 'admin'
                    ? 'bg-forensic-500/30 text-forensic-300 shadow'
                    : 'text-white/40 hover:text-white/70'}`}
              >
                <Settings size={13} />
                <span className="hidden sm:inline">Admin</span>
                <span className="sm:hidden">Upload</span>
              </button>
            </div>

            {/* Status pill — desktop only */}
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI Online
            </div>
          </div>
        </div>
      </header>

      {/* ── Page title ── */}
      <div className="mx-auto max-w-6xl px-4 pt-5 pb-2 sm:px-6 sm:pt-8">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white">
          {activeTab === 'search' ? 'Surveillance Analysis' : 'Admin — Data Upload'}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-white/40">
          {activeTab === 'search'
            ? 'Filters lagao, camera photo upload karo, aur suspect database se match karo.'
            : 'CSV file upload karke suspect metadata bulk mein add ya update karo.'}
        </p>
      </div>

      {/* ── Main Layout ── */}
      <main className="mx-auto max-w-6xl px-4 py-4 sm:py-6 sm:px-6 space-y-4 sm:space-y-6
                       pb-28 sm:pb-8">  {/* pb-28 on mobile = space for sticky button */}

        {/* ── Admin Tab ── */}
        {activeTab === 'admin' && (
          <div className="max-w-xl mx-auto">
            <AdminPanel />
          </div>
        )}

        {/* ── Search Tab ── */}
        {activeTab === 'search' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">

            {/* ─── Left: Input Panel ─── */}
            <div className="space-y-4 sm:space-y-5">

              {/* Step 1 — Pre-Search Filters */}
              <FilterPanel filters={filters} onChange={setFilters} />

              {/* Step 2 — Upload Frame */}
              <div className="glass-card p-4 sm:p-5 space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/40">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forensic-500/20 text-[10px] font-bold text-forensic-400">2</span>
                  Upload Camera Photo
                </h2>
                <UploadZone onFileSelected={handleFileSelected} previewUrl={previewUrl} />
              </div>

              {/* Step 3 — AI Controls */}
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/40">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forensic-500/20 text-[10px] font-bold text-forensic-400">3</span>
                  AI Controls
                </h2>
                <FidelitySlider value={fidelityW} onChange={setFidelityW} />
              </div>

              {/* Analyze button — DESKTOP only (mobile has sticky button below) */}
              <button
                id="analyze-btn"
                onClick={handleAnalyze}
                disabled={!imageFile || isLoading}
                className="hidden sm:flex btn-primary w-full items-center justify-center gap-3 py-4 text-base"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Analyzing Pipeline…</span>
                  </>
                ) : (
                  <>
                    <Scan size={20} />
                    <span>
                      Search
                      {activeFilterCount > 0 && (
                        <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                          {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                        </span>
                      )}
                    </span>
                  </>
                )}
              </button>

              {/* Loading progress */}
              {isLoading && (
                <div className="glass-card p-4 space-y-2 animate-fade-in">
                  {[
                    { label: 'Stage 1 — Image Enhancement', done: true },
                    { label: 'Stage 2 — Face Detection (YOLOv8)', done: true },
                    { label: 'Stage 3 — ArcFace Embedding Extraction', done: false },
                    { label: 'Stage 4 — Filtered Database Matching', done: false },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Loader2
                        size={12}
                        className={`shrink-0 ${step.done ? 'text-emerald-400 animate-spin' : 'text-white/20'}`}
                      />
                      <span className={`text-xs ${step.done ? 'text-white/60' : 'text-white/20'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Error message */}
              {status === STATUS.ERROR && (
                <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4 animate-fade-in">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                  <div>
                    <p className="text-sm font-semibold text-red-400">Pipeline Error</p>
                    <p className="mt-0.5 text-xs text-white/50">{errorMsg}</p>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Right: Results Panel ─── */}
            <div className="space-y-4 sm:space-y-5">
              {status === STATUS.SUCCESS && result ? (
                <>
                  <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/40">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forensic-500/20 text-[10px] font-bold text-forensic-400">4</span>
                    Results
                  </p>

                  <ImageComparison
                    originalUrl={previewUrl}
                    enhancedUrl={result.enhancedImageUrl}
                  />

                  <ResultCard result={result} />
                </>
              ) : (
                /* Empty state — hidden on mobile to save space */
                <div className="hidden lg:flex glass-card min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="rounded-full bg-white/5 p-6 ring-1 ring-white/10">
                    <Scan size={36} className="text-white/20" />
                  </div>
                  <div>
                    <p className="font-semibold text-white/30">Results appear here</p>
                    <p className="mt-1 text-sm text-white/20">
                      Set filters (optional) → Upload Camera Photo → Search
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* ── Sticky Bottom Search Button — MOBILE ONLY ── */}
      {activeTab === 'search' && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-50
                        bg-surface-950/95 backdrop-blur-lg border-t border-white/5
                        px-4 py-3 safe-area-pb">
          <button
            id="analyze-btn-mobile"
            onClick={handleAnalyze}
            disabled={!imageFile || isLoading}
            className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-base rounded-2xl"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Analyzing…</span>
              </>
            ) : (
              <>
                <Scan size={20} />
                <span>
                  Search
                  {activeFilterCount > 0 && (
                    <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                      {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                    </span>
                  )}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="hidden sm:block mt-10 border-t border-white/5 py-6 text-center">
        <p className="text-xs text-white/20">
          ForensicAI Case Management — 4-Stage Pipeline: YOLOv8 · ArcFace · Cosine Matching · Attribute Filtering
        </p>
      </footer>
    </div>
  )
}
