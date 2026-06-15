import { useRef, useState } from 'react'
import { UploadCloud, Camera, Image } from 'lucide-react'

/**
 * UploadZone
 * Supports:
 *  - Drag & drop (desktop)
 *  - Click to open file explorer (desktop/mobile)
 *  - Camera capture (mobile — capture="environment")
 */
export default function UploadZone({ onFileSelected, previewUrl }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    onFileSelected(file)
  }

  /* Drag handlers */
  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = ()  => setDragging(false)
  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div
      className={`drop-zone relative flex flex-col items-center justify-center
                  min-h-[220px] p-6 text-center select-none
                  ${dragging ? 'active' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      aria-label="Upload CCTV image"
    >
      {/* Hidden file input — supports both file picker & camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        id="cctv-file-input"
      />

      {previewUrl ? (
        /* Preview thumbnail */
        <div className="relative w-full">
          <img
            src={previewUrl}
            alt="Selected CCTV frame"
            className="mx-auto max-h-48 rounded-xl object-contain shadow-lg"
          />
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-white/50">
            <Image size={14} />
            <span>Tap to change image</span>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full bg-forensic-500/10 p-5 ring-1 ring-forensic-500/20">
            <UploadCloud size={40} className="text-forensic-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-white/90">
              Drop CCTV frame here
            </p>
            <p className="mt-1 text-sm text-white/40">
              or tap to browse / use camera
            </p>
          </div>
          {/* Mobile camera hint */}
          <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs text-white/50">
            <Camera size={13} />
            <span>Mobile: camera access supported</span>
          </div>
          <p className="text-xs text-white/30">JPEG · PNG · WebP</p>
        </div>
      )}
    </div>
  )
}
