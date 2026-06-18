import { useState, useRef } from 'react'
import {
  Upload, FileSpreadsheet, CheckCircle, AlertCircle,
  Loader2, X, ChevronDown, ChevronUp, Database,
  ImagePlus, FileUp, User
} from 'lucide-react'
import { bulkUploadCsv, uploadSuspectWithCsv } from '../api/forensic'

export default function AdminPanel() {
  const [subTab, setSubTab] = useState('single') // 'single' | 'bulk'

  return (
    <div className="space-y-5">
      {/* Sub-tab switcher */}
      <div className="flex gap-2 rounded-xl bg-white/5 p-1">
        <button
          id="subtab-single"
          onClick={() => setSubTab('single')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all duration-200
            ${subTab === 'single'
              ? 'bg-forensic-500/30 text-forensic-300'
              : 'text-white/40 hover:text-white/70'}`}
        >
          <ImagePlus size={14} />
          Single Suspect Upload
        </button>
        <button
          id="subtab-bulk"
          onClick={() => setSubTab('bulk')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all duration-200
            ${subTab === 'bulk'
              ? 'bg-forensic-500/30 text-forensic-300'
              : 'text-white/40 hover:text-white/70'}`}
        >
          <FileUp size={14} />
          Bulk CSV Upload
        </button>
      </div>

      {subTab === 'single' ? <SingleUpload /> : <BulkCsvUpload />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SUSPECT UPLOAD — Image + CSV file (1 row)
// ─────────────────────────────────────────────────────────────────────────────
function SingleUpload() {
  const [imageFile, setImageFile] = useState(null)
  const [csvFile, setCsvFile]     = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [status, setStatus]       = useState('IDLE')
  const [result, setResult]       = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const imgRef = useRef(null)
  const csvRef = useRef(null)

  const handleImage = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setStatus('IDLE'); setResult(null); setErrorMsg('')
  }

  const handleCsv = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Sirf .csv file allowed hai'); setStatus('ERROR'); return
    }
    setCsvFile(file)
    setStatus('IDLE'); setResult(null); setErrorMsg('')
  }

  const handleSubmit = async () => {
    if (!imageFile || !csvFile) return
    setStatus('LOADING'); setResult(null); setErrorMsg('')
    try {
      const data = await uploadSuspectWithCsv(imageFile, csvFile)
      setResult(data)
      setStatus('SUCCESS')
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Upload failed.')
      setStatus('ERROR')
    }
  }

  const clearAll = () => {
    setImageFile(null); setCsvFile(null); setImagePreview(null)
    setStatus('IDLE'); setResult(null); setErrorMsg('')
    if (imgRef.current) imgRef.current.value = ''
    if (csvRef.current) csvRef.current.value = ''
  }

  const canSubmit = imageFile && csvFile && status !== 'LOADING'

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="rounded-xl bg-white/3 border border-white/5 px-4 py-3">
        <p className="text-xs text-white/40 leading-relaxed">
          Ek suspect ki <strong className="text-white/60">image</strong> aur uski
          <strong className="text-white/60"> CSV file</strong> (1 row) dono saath upload karo.
          System face embedding extract karke database mein save karega.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Image Upload */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-white/40 font-semibold flex items-center gap-1.5">
            <ImagePlus size={12} className="text-forensic-400" /> Suspect Photo
          </p>
          <div
            className="drop-zone flex flex-col items-center justify-center min-h-[160px] p-4 text-center cursor-pointer"
            onClick={() => imgRef.current?.click()}
          >
            <input ref={imgRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleImage(e.target.files?.[0])} id="single-img-input" />
            {imagePreview ? (
              <div className="relative w-full">
                <img src={imagePreview} alt="preview"
                  className="mx-auto max-h-36 rounded-xl object-cover border border-white/10" />
                <p className="mt-2 text-[10px] text-white/30">Click to change</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-forensic-500/10 p-4 ring-1 ring-forensic-500/20">
                  <User size={28} className="text-forensic-500" />
                </div>
                <p className="text-sm text-white/60">Photo upload karo</p>
                <p className="text-xs text-white/25">JPEG · PNG · WebP</p>
              </div>
            )}
          </div>
          {imageFile && (
            <p className="text-[10px] text-emerald-400/70 truncate">✓ {imageFile.name}</p>
          )}
        </div>

        {/* CSV Upload */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-white/40 font-semibold flex items-center gap-1.5">
            <FileSpreadsheet size={12} className="text-forensic-400" /> CSV File (1 row)
          </p>
          <div
            className="drop-zone flex flex-col items-center justify-center min-h-[160px] p-4 text-center cursor-pointer"
            onClick={() => csvRef.current?.click()}
          >
            <input ref={csvRef} type="file" accept=".csv" className="hidden"
              onChange={e => handleCsv(e.target.files?.[0])} id="single-csv-input" />
            {csvFile ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-emerald-500/10 p-4 ring-1 ring-emerald-500/20">
                  <FileSpreadsheet size={28} className="text-emerald-400" />
                </div>
                <p className="text-sm text-white/70 truncate max-w-full">{csvFile.name}</p>
                <p className="text-[10px] text-white/30">Click to change</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-forensic-500/10 p-4 ring-1 ring-forensic-500/20">
                  <FileSpreadsheet size={28} className="text-forensic-500" />
                </div>
                <p className="text-sm text-white/60">CSV upload karo</p>
                <p className="text-xs text-white/25">Sirf .csv</p>
              </div>
            )}
          </div>
          {csvFile && (
            <p className="text-[10px] text-emerald-400/70 truncate">✓ {csvFile.name}</p>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="btn-primary flex-1 flex items-center justify-center gap-3 py-3.5 text-sm"
        >
          {status === 'LOADING' ? (
            <><Loader2 size={18} className="animate-spin" /><span>Processing…</span></>
          ) : (
            <><Upload size={18} /><span>Upload Suspect</span></>
          )}
        </button>
        {(imageFile || csvFile) && status !== 'LOADING' && (
          <button onClick={clearAll}
            className="px-4 rounded-xl border border-white/10 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Loading hint */}
      {status === 'LOADING' && (
        <div className="glass-card p-3 text-xs text-white/40 flex items-center gap-2">
          <Loader2 size={12} className="animate-spin text-forensic-400" />
          Face embedding extract ho rahi hai, please wait (30–60 sec)…
        </div>
      )}

      {/* Success */}
      {status === 'SUCCESS' && result && (
        <div className="glass-card p-4 border border-emerald-500/30 bg-emerald-500/5 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-400">Suspect Added!</p>
          </div>
          <div className="text-xs text-white/50 space-y-1">
            <p>DB ID: <span className="text-white/80 font-mono">{result.id}</span></p>
            {result.dd_no && <p>DD No: <span className="text-white/80 font-mono">{result.dd_no}</span></p>}
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'ERROR' && (
        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-400">Error</p>
            <p className="mt-0.5 text-xs text-white/50">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK CSV UPLOAD — metadata only (no image)
// ─────────────────────────────────────────────────────────────────────────────
function BulkCsvUpload() {
  const [csvFile, setCsvFile]     = useState(null)
  const [dragging, setDragging]   = useState(false)
  const [status, setStatus]       = useState('IDLE')
  const [result, setResult]       = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const inputRef = useRef(null)

  const handleFile = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Sirf CSV file upload karein (.csv)')
      setStatus('ERROR'); return
    }
    setCsvFile(file); setStatus('IDLE'); setResult(null); setErrorMsg('')
  }

  const onDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = ()  => setDragging(false)
  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleUpload = async () => {
    if (!csvFile) return
    setStatus('LOADING'); setResult(null); setErrorMsg('')
    try {
      const data = await bulkUploadCsv(csvFile)
      setResult(data); setStatus('SUCCESS')
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Upload failed.')
      setStatus('ERROR')
    }
  }

  const handleClear = () => {
    setCsvFile(null); setStatus('IDLE'); setResult(null); setErrorMsg('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="glass-card p-4 border border-forensic-500/20 bg-forensic-500/5">
        <div className="flex items-start gap-3">
          <Database size={16} className="text-forensic-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Bulk Metadata Update</p>
            <p className="text-xs text-white/40 mt-1 leading-relaxed">
              CSV file se existing records update honge ya naye insert honge —
              <strong className="text-white/60"> dd_no</strong> se match hoga.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {['dd_no','found_date','found_district','ps_name','found_loc','gender',
                'age_min','age_max','height_cm','build','skin_tone','hair_color',
                'beard','visible_marks','clothing_description','notes'].map(col => (
                <span key={col} className="font-mono text-[10px] text-forensic-400/70 bg-black/20 px-2 py-0.5 rounded">
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`drop-zone flex flex-col items-center justify-center min-h-[160px] p-6 text-center
          ${dragging ? 'active' : ''}`}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden"
          onChange={e => handleFile(e.target.files?.[0])} id="bulk-csv-input" />

        {csvFile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/30">
              <FileSpreadsheet size={28} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{csvFile.name}</p>
              <p className="text-xs text-white/40 mt-0.5">{(csvFile.size / 1024).toFixed(1)} KB — Click to change</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-forensic-500/10 p-5 ring-1 ring-forensic-500/20">
              <FileSpreadsheet size={36} className="text-forensic-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-white/90">CSV file yahan drop karein</p>
              <p className="mt-1 text-sm text-white/40">ya click karke browse karein</p>
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleUpload}
          disabled={!csvFile || status === 'LOADING'}
          className="btn-primary flex-1 flex items-center justify-center gap-3 py-3.5 text-sm"
        >
          {status === 'LOADING' ? (
            <><Loader2 size={18} className="animate-spin" /><span>Uploading…</span></>
          ) : (
            <><Upload size={18} /><span>Bulk Upload Karo</span></>
          )}
        </button>
        {csvFile && status !== 'LOADING' && (
          <button onClick={handleClear}
            className="px-4 rounded-xl border border-white/10 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Success */}
      {status === 'SUCCESS' && result && (
        <div className="glass-card p-5 border border-emerald-500/30 bg-emerald-500/5 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-400">Upload Successful!</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatBox label="Total" value={result.total} color="white" />
            <StatBox label="Updated" value={result.updated} color="emerald" />
            <StatBox label="Inserted" value={result.inserted} color="forensic" />
          </div>
          {result.errors?.length > 0 && (
            <div>
              <button onClick={() => setShowErrors(e => !e)}
                className="flex items-center gap-2 text-xs text-yellow-400/80 hover:text-yellow-400 transition-colors">
                <AlertCircle size={13} />
                {result.errors.length} errors
                {showErrors ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
              </button>
              {showErrors && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-[10px] text-white/40 font-mono bg-black/20 px-3 py-1.5 rounded-lg">
                      dd_no: {e.dd_no} — {e.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'ERROR' && (
        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-400">Upload Failed</p>
            <p className="mt-0.5 text-xs text-white/50">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color }) {
  const colors = {
    white:    'text-white bg-white/5 border-white/10',
    emerald:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    forensic: 'text-forensic-400 bg-forensic-500/10 border-forensic-500/20',
  }
  return (
    <div className={`rounded-xl border px-3 py-3 text-center ${colors[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-60 mt-0.5">{label}</p>
    </div>
  )
}
