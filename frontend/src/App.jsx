import { useState, useCallback } from 'react'
import { Scan, Loader2, AlertCircle, Shield } from 'lucide-react'
import UploadZone from './components/UploadZone'
import FidelitySlider from './components/FidelitySlider'
import ImageComparison from './components/ImageComparison'
import ResultCard from './components/ResultCard'
import { analyzeAndMatch } from './api/forensic'

const STATUS = { IDLE: 'IDLE', LOADING: 'LOADING', SUCCESS: 'SUCCESS', ERROR: 'ERROR' }

export default function App() {
  const [imageFile, setImageFile]       = useState(null)
  const [previewUrl, setPreviewUrl]     = useState(null)
  const [fidelityW, setFidelityW]       = useState(0.85)
  const [status, setStatus]             = useState(STATUS.IDLE)
  const [result, setResult]             = useState(null)
  const [errorMsg, setErrorMsg]         = useState('')

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
      const data = await analyzeAndMatch(imageFile, fidelityW)
      setResult(data)
      setStatus(STATUS.SUCCESS)
    } catch (err) {
      const msg =
        err.response?.data?.message
        || err.response?.data
        || err.message
        || 'An unexpected error occurred.'
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg))
      setStatus(STATUS.ERROR)
    }
  }

  const isLoading = status === STATUS.LOADING

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-surface-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forensic-500/20 ring-1 ring-forensic-500/30">
              <Shield size={18} className="text-forensic-400" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-white">ForensicAI</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Case Manager</p>
            </div>
          </div>

          {/* Status pill */}
          <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AI Pipeline Online
          </div>
        </div>
      </header>

      {/* ── Page title ── */}
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-2 sm:px-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Surveillance Analysis
        </h1>
        <p className="mt-1 text-sm text-white/40">
          Upload a CCTV frame to enhance, detect, and match against the suspect database.
        </p>
      </div>

      {/* ── Main Layout ── */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">

        {/*
          INPUT COLUMN (always full-width on mobile)
          On lg+, sits in a 2-col grid beside the results
        */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ─── Left: Input Panel ─── */}
          <div className="space-y-5">
            {/* Upload zone */}
            <div className="glass-card p-5 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40">
                Step 1 — Upload Frame
              </h2>
              <UploadZone onFileSelected={handleFileSelected} previewUrl={previewUrl} />
            </div>

            {/* Fidelity slider */}
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/40">
                Step 2 — AI Controls
              </h2>
              <FidelitySlider value={fidelityW} onChange={setFidelityW} />
            </div>

            {/* Analyze button */}
            <button
              id="analyze-btn"
              onClick={handleAnalyze}
              disabled={!imageFile || isLoading}
              className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-base"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Analyzing Pipeline…</span>
                </>
              ) : (
                <>
                  <Scan size={20} />
                  <span>Analyze &amp; Match</span>
                </>
              )}
            </button>

            {/* Loading progress hint */}
            {isLoading && (
              <div className="glass-card p-4 space-y-2 animate-fade-in">
                {[
                  { label: 'Stage 1 — Enhancing with CodeFormer', done: true },
                  { label: 'Stage 2 — Detecting face (YOLOv8)', done: true },
                  { label: 'Stage 3 — Extracting ArcFace embedding', done: false },
                  { label: 'Stage 4 — Matching against database', done: false },
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
          <div className="space-y-5">
            {status === STATUS.SUCCESS && result ? (
              <>
                {/* Step 3 header */}
                <p className="text-sm font-semibold uppercase tracking-widest text-white/40">
                  Step 3 — Results
                </p>

                {/* Image comparison */}
                <ImageComparison
                  originalUrl={previewUrl}
                  enhancedUrl={result.enhancedImageUrl}
                />

                {/* Identity match result */}
                <ResultCard result={result} />
              </>
            ) : (
              /* Placeholder when no result yet */
              <div className="glass-card flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="rounded-full bg-white/5 p-6 ring-1 ring-white/10">
                  <Scan size={36} className="text-white/20" />
                </div>
                <div>
                  <p className="font-semibold text-white/30">Results appear here</p>
                  <p className="mt-1 text-sm text-white/20">
                    Upload a CCTV frame and click Analyze &amp; Match
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-10 border-t border-white/5 py-6 text-center">
        <p className="text-xs text-white/20">
          ForensicAI Case Management — 4-Stage Pipeline: CodeFormer · YOLOv8 · ArcFace · Cosine Matching
        </p>
      </footer>
    </div>
  )
}
