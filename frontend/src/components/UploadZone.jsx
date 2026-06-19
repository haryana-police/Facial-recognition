import { useRef, useState } from 'react'
import { UploadCloud, Camera, Image } from 'lucide-react'

/**
 * UploadZone
 * Mobile-first:
 *  - Large touch-friendly tap area
 *  - Separate "Gallery" and "Camera" buttons on mobile
 *  - Drag & drop on desktop
 */
export default function UploadZone({ onFileSelected, previewUrl }) {
  const fileRef   = useRef(null)  // gallery / file picker
  const cameraRef = useRef(null)  // direct camera
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    onFileSelected(file)
  }

  /* Drag handlers (desktop) */
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = ()  => setDragging(false)
  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="space-y-3">
      {/* Hidden inputs */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        id="gallery-photo-input"
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        id="camera-photo-input"
      />

      {/* Drop Zone / Preview */}
      <div
        className={`drop-zone relative flex flex-col items-center justify-center
                    min-h-[180px] sm:min-h-[220px] p-4 sm:p-6 text-center select-none
                    ${dragging ? 'active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        aria-label="Upload camera photo"
      >
        {previewUrl ? (
          /* Preview thumbnail */
          <div className="relative w-full">
            <img
              src={previewUrl}
              alt="Selected camera photo"
              className="mx-auto max-h-44 sm:max-h-48 rounded-xl object-contain shadow-lg"
            />
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-white/50">
              <Image size={14} />
              <span>Tap to change image</span>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <div className="rounded-full bg-forensic-500/10 p-4 sm:p-5 ring-1 ring-forensic-500/20">
              <UploadCloud size={36} className="text-forensic-500" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-semibold text-white/90">
                Drop photo here
              </p>
              <p className="mt-1 text-xs sm:text-sm text-white/40">
                or use the buttons below
              </p>
            </div>
            <p className="text-xs text-white/30">JPEG · PNG · WebP</p>
          </div>
        )}
      </div>

      {/* Mobile action buttons — large touch targets */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl
                     bg-forensic-500/20 border border-forensic-500/30
                     py-3.5 text-sm font-semibold text-forensic-300
                     active:scale-95 transition-transform"
        >
          <Camera size={18} />
          Camera
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl
                     bg-white/5 border border-white/10
                     py-3.5 text-sm font-semibold text-white/60
                     active:scale-95 transition-transform"
        >
          <Image size={18} />
          Gallery
        </button>
      </div>
    </div>
  )
}
