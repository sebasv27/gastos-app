import { useState } from 'react'
import { Dumbbell } from 'lucide-react'

type Imageable = { image?: string | null; images?: string[] | null } | null | undefined

/** URL de la foto de un ejercicio, venga del selector (image) o de la BD (images[]). */
export function exerciseImageUrl(e: Imageable): string | null {
  if (!e) return null
  if (e.image) return e.image
  const first = e.images?.[0]
  if (!first) return null
  return first.startsWith('/') ? first : `/exercise-images/${first}`
}

export default function ExerciseThumb({ src, size = 'w-10 h-10' }: { src?: string | null; size?: string }) {
  const [error, setError] = useState(false)
  if (!src || error) {
    return (
      <div className={`${size} rounded-lg bg-white border border-slate-200 text-slate-300 flex items-center justify-center shrink-0`}>
        <Dumbbell size={16} />
      </div>
    )
  }
  return (
    <img src={src} alt="" loading="lazy" onError={() => setError(true)}
         className={`${size} rounded-lg object-cover bg-white shrink-0`} />
  )
}
