// src/pages/DeployPage.tsx  —  Fase 4
import { useState } from 'react'
import {
  Server, Globe, GitBranch, CheckCircle2,
  Circle, Copy, ExternalLink, ChevronDown, ChevronUp, Terminal
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Step {
  id: string
  title: string
  done: boolean
}

const copy = (text: string) => {
  navigator.clipboard.writeText(text)
  toast.success('Copiado')
}

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => copy(code)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700 hover:bg-slate-600 text-slate-300 p-1.5 rounded-lg"
      >
        <Copy size={12} />
      </button>
    </div>
  )
}

function Section({ icon, title, color, children, defaultOpen = false }: {
  icon: React.ReactNode; title: string; color: string
  children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="font-semibold text-dark flex-1 text-left">{title}</span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">{children}</div>}
    </div>
  )
}

export default function DeployPage() {
  const [checklist, setChecklist] = useState<Step[]>([
    { id: 'github',   title: 'Repositorio creado en GitHub',         done: false },
    { id: 'railway',  title: 'Backend desplegado en Railway',         done: false },
    { id: 'db',       title: 'PostgreSQL conectado en Railway',       done: false },
    { id: 'vars',     title: 'Variables de entorno configuradas',     done: false },
    { id: 'vercel',   title: 'Frontend desplegado en Vercel',         done: false },
    { id: 'cors',     title: 'FRONTEND_URL actualizado en Railway',   done: false },
    { id: 'test',     title: 'Registro de usuario funciona en prod',  done: false },
    { id: 'android',  title: 'App Android conectada al servidor prod',done: false },
  ])

  const toggle = (id: string) =>
    setChecklist(c => c.map(s => s.id === id ? { ...s, done: !s.done } : s))

  const done = checklist.filter(s => s.done).length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-dark">Deploy a Producción</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Railway (backend) + Vercel (frontend) — 100% gratis para empezar
        </p>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-dark">Progreso de configuración</span>
          <span className="text-sm font-bold text-brand-600">{done}/{checklist.length}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${(done / checklist.length) * 100}%` }}
          />
        </div>
        <div className="mt-4 space-y-2">
          {checklist.map(s => (
            <button key={s.id} onClick={() => toggle(s.id)}
              className="w-full flex items-center gap-3 text-left hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors">
              {s.done
                ? <CheckCircle2 size={16} className="text-brand-500 shrink-0" />
                : <Circle size={16} className="text-slate-300 shrink-0" />}
              <span className={`text-sm ${s.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {s.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 1 — GitHub */}
      <Section icon={<GitBranch size={16} className="text-white" />}
        color="bg-slate-800" title="Paso 1 — Subir a GitHub" defaultOpen={true}>
        <p className="text-sm text-slate-600">
          Railway y Vercel se conectan a tu repositorio de GitHub para hacer deploy automático con cada <code className="bg-slate-100 px-1 rounded">git push</code>.
        </p>
        <CodeBlock code={`# En la raíz del proyecto
git init
git add .
git commit -m "feat: gastos app completa fases 1-4"

# Crea el repo en github.com/new y luego:
git remote add origin https://github.com/TU_USUARIO/gastos-app.git
git branch -M main
git push -u origin main`} />
        <div className="flex gap-2">
          <a href="https://github.com/new" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
            <ExternalLink size={11} />Crear repositorio en GitHub
          </a>
        </div>
      </Section>

      {/* Step 2 — Railway Backend */}
      <Section icon={<Server size={16} className="text-white" />}
        color="bg-violet-600" title="Paso 2 — Backend en Railway">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">2a. Crear proyecto</p>
            <ol className="text-sm text-slate-600 space-y-1.5 list-decimal list-inside">
              <li>Ve a <a href="https://railway.app" target="_blank" rel="noreferrer" className="text-brand-600 underline">railway.app</a> y crea cuenta con GitHub</li>
              <li>New Project → Deploy from GitHub repo → selecciona <strong>gastos-app</strong></li>
              <li>Root Directory: <code className="bg-slate-100 px-1 rounded">backend</code></li>
              <li>Railway detecta Node.js automáticamente</li>
            </ol>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">2b. Agregar PostgreSQL</p>
            <ol className="text-sm text-slate-600 space-y-1.5 list-decimal list-inside">
              <li>En tu proyecto Railway: <strong>+ New</strong> → Database → PostgreSQL</li>
              <li>Railway inyecta <code className="bg-slate-100 px-1 rounded">DATABASE_URL</code> automáticamente</li>
            </ol>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">2c. Variables de entorno en Railway</p>
            <p className="text-sm text-slate-500 mb-2">
              Ve a tu servicio → <strong>Variables</strong> → Raw Editor → pega esto:
            </p>
            <CodeBlock code={`JWT_SECRET=GENERA_UN_STRING_DE_32_CHARS_AQUI
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://TU-APP.vercel.app
GEMINI_API_KEY=AIza...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASS=tu_app_password`} />
            <p className="text-xs text-slate-400 mt-2">
              Genera JWT_SECRET con:
            </p>
            <CodeBlock code={`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`} />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">2d. Verificar deploy</p>
            <p className="text-sm text-slate-600 mb-2">
              Una vez Railway termine el build, abre la URL pública y verifica:
            </p>
            <CodeBlock code={`# Reemplaza con tu URL de Railway
curl https://gastos-backend-production.up.railway.app/health

# Debería responder:
# {"status":"ok","env":"production","ts":"2026-..."}`} />
          </div>
        </div>
      </Section>

      {/* Step 3 — Vercel Frontend */}
      <Section icon={<Globe size={16} className="text-white" />}
        color="bg-black" title="Paso 3 — Frontend en Vercel">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">3a. Importar proyecto</p>
            <ol className="text-sm text-slate-600 space-y-1.5 list-decimal list-inside">
              <li>Ve a <a href="https://vercel.com/new" target="_blank" rel="noreferrer" className="text-brand-600 underline">vercel.com/new</a> e importa <strong>gastos-app</strong></li>
              <li>Root Directory: <code className="bg-slate-100 px-1 rounded">frontend</code></li>
              <li>Framework Preset: <strong>Vite</strong></li>
            </ol>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">3b. Variable de entorno</p>
            <p className="text-sm text-slate-500 mb-2">
              En Vercel → Settings → Environment Variables:
            </p>
            <CodeBlock code={`VITE_API_URL = https://gastos-backend-production.up.railway.app`} />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">3c. Actualizar CORS en Railway</p>
            <p className="text-sm text-slate-600">
              Una vez Vercel te asigne el dominio (ej. <code className="bg-slate-100 px-1 rounded">gastos-app.vercel.app</code>), vuelve a Railway y actualiza:
            </p>
            <CodeBlock code={`FRONTEND_URL=https://gastos-app.vercel.app`} />
          </div>
        </div>
      </Section>

      {/* Step 4 — CI/CD */}
      <Section icon={<Terminal size={16} className="text-white" />}
        color="bg-brand-600" title="Paso 4 — CI/CD automático (GitHub Actions)">
        <p className="text-sm text-slate-600">
          El archivo <code className="bg-slate-100 px-1 rounded">.github/workflows/deploy.yml</code> ya está incluido.
          Solo necesitas configurar estos secretos en GitHub:
        </p>
        <p className="text-xs text-slate-500 mb-1">GitHub → tu repo → Settings → Secrets and variables → Actions → New secret:</p>
        <div className="space-y-2">
          {[
            { name: 'DATABASE_URL',      desc: 'Desde Railway → PostgreSQL → Connect' },
            { name: 'VITE_API_URL',      desc: 'URL pública de Railway' },
            { name: 'RAILWAY_TOKEN',     desc: 'Railway → Account → Tokens → Create' },
            { name: 'VERCEL_TOKEN',      desc: 'Vercel → Settings → Tokens → Create' },
            { name: 'VERCEL_ORG_ID',     desc: 'Vercel → Settings → General → Team ID' },
            { name: 'VERCEL_PROJECT_ID', desc: 'Vercel → tu proyecto → Settings → General' },
          ].map(({ name, desc }) => (
            <div key={name} className="flex items-start gap-3 bg-slate-50 rounded-lg px-3 py-2">
              <code className="text-xs font-mono text-violet-700 w-44 shrink-0 mt-0.5">{name}</code>
              <span className="text-xs text-slate-500">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Con esto configurado, cada <code className="bg-slate-100 px-1 rounded">git push main</code> hace deploy automático a Railway y Vercel.
        </p>
      </Section>

      {/* Step 5 — Android */}
      <Section icon={<Globe size={16} className="text-white" />}
        color="bg-green-600" title="Paso 5 — Conectar app Android a producción">
        <p className="text-sm text-slate-600">
          Con el servidor en internet, la app Android puede conectarse desde cualquier red — no solo tu WiFi de casa.
        </p>
        <ol className="text-sm text-slate-600 space-y-1.5 list-decimal list-inside">
          <li>Abre la app Android en tu celular</li>
          <li>En URL del servidor escribe tu URL de Railway:<br/>
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs mt-1 block w-fit">
              https://gastos-backend-production.up.railway.app
            </code>
          </li>
          <li>Ingresa tu email y contraseña</li>
          <li>Toca <strong>Conectar y activar monitoreo</strong></li>
          <li>Haz un pago con Nequi y verifica que aparece en el dashboard en segundos</li>
        </ol>
      </Section>

      {/* Troubleshooting */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-amber-800 mb-3">⚠️ Problemas comunes</h3>
        <div className="space-y-3">
          {[
            {
              p: 'Error CORS al hacer login desde Vercel',
              s: 'Verifica que FRONTEND_URL en Railway sea exactamente la URL de Vercel sin / al final'
            },
            {
              p: 'Railway falla en el build con "prisma: not found"',
              s: 'El buildCommand en railway.toml ya incluye "npx prisma generate". Si persiste, agrega PRISMA_CLI_BINARY_TARGETS=linux-musl en Variables'
            },
            {
              p: 'La app Android dice "Token inválido"',
              s: 'El token del .env de desarrollo no funciona en producción. Haz login de nuevo desde la app Android con la URL de Railway'
            },
            {
              p: 'Vercel muestra pantalla en blanco',
              s: 'Revisa que VITE_API_URL no tenga /api al final — la app lo agrega sola'
            },
          ].map(({ p, s }) => (
            <div key={p}>
              <p className="text-xs font-semibold text-amber-700">{p}</p>
              <p className="text-xs text-amber-600 mt-0.5">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
