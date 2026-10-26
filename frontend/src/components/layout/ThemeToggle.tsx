import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

type Tema = 'light' | 'dark' | 'system'

function aplicar(t: Tema) {
  const oscuro = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', oscuro)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0b1220' : '#0F6E56')
}

export default function ThemeToggle() {
  const [tema, setTema] = useState<Tema>(() => {
    try { return (localStorage.getItem('theme') as Tema) || 'system' } catch { return 'system' }
  })

  useEffect(() => {
    aplicar(tema)
    try { localStorage.setItem('theme', tema) } catch { /* modo privado */ }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiar = () => { if (tema === 'system') aplicar('system') }
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [tema])

  const opciones: [Tema, typeof Sun, string][] = [
    ['light', Sun, 'Tema claro'], ['dark', Moon, 'Tema oscuro'], ['system', Monitor, 'Según el dispositivo'],
  ]

  return (
    <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-white/5 mb-2">
      {opciones.map(([t, Icono, label]) => (
        <button key={t} onClick={() => setTema(t)} title={label} aria-label={label}
          className={`flex items-center justify-center py-1.5 rounded-md transition-colors ${
            tema === t ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}>
          <Icono size={14} />
        </button>
      ))}
    </div>
  )
}
