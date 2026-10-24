# 💰 Control de Gastos — Proyecto Completo

App de finanzas personales + fitness con IA (Claude API).

## Stack
- **Backend**: Node.js + Express + Prisma + PostgreSQL
- **Frontend**: React + TypeScript + Tailwind + Vite
- **IA**: Claude API (recibos OCR, fotos de comidas, recomendaciones de recetas)
- **Android**: Kotlin (monitoreo de notificaciones bancarias)

## Instalación desde cero

### 1. Requisitos
- Node.js 20+
- Docker (para PostgreSQL)
- Cuenta en [console.anthropic.com](https://console.anthropic.com) para la API key de Claude

### 2. Clonar y configurar

```bash
# Instalar backend
cd backend
cp .env.example .env
# Editar .env con tus valores (especialmente ANTHROPIC_API_KEY y JWT_SECRET)
npm install

# Levantar PostgreSQL
cd ..
docker compose up -d

# Migrar base de datos y cargar datos iniciales
cd backend
npx prisma migrate dev --name init
npm run db:seed

# Arrancar backend
npm run dev
# → http://localhost:4000
```

```bash
# Instalar frontend (en otra terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 3. Variables de entorno obligatorias (.env)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/gastos_app` |
| `JWT_SECRET` | String aleatorio 32+ chars: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | Desde console.anthropic.com → API Keys |
| `FRONTEND_URL` | `http://localhost:5173` en desarrollo |

### 4. Usuario demo
- Email: `demo@gastos.com`
- Contraseña: `demo123456`

## Funcionalidades

### 💰 Finanzas
- Dashboard con gráficas de gastos por categoría y día
- Gestión de transacciones con filtros y exportación CSV
- Presupuestos mensuales con alertas al 80% y 100%
- Metas de ahorro con progreso
- Alertas por email (resumen semanal)

### 📸 Captura inteligente
- **OCR de recibos**: foto → Claude extrae monto, comercio, fecha y categoría
- **Auto-categorización**: escribe "Uber" → sugiere "Transporte" automáticamente
- **Notificaciones bancarias**: app Android intercepta notificaciones de Bancolombia, Nequi, Daviplata

### 🏋️ Fitness
- **Macros automáticas**: ingresa peso, altura y objetivo → Claude calcula TDEE y macros (Mifflin-St Jeor)
- **Progreso**: gráficas de peso con promedio móvil + volumen de entreno semanal
- **Rutinas**: plantillas reutilizables con superseries, RPE, timer de descanso
- **Comidas**: registro manual o por foto (Claude estima calorías y macros)
- **Recetas IA**: Claude genera recetas personalizadas según tus macros del día
- **Mis Recetas**: guarda las que te gustan con ingredientes y pasos completos

## Deploy a producción
- Backend → Railway (incluye `railway.toml`)
- Frontend → Vercel (incluye `vercel.json`)
- CI/CD → GitHub Actions (`.github/workflows/deploy.yml`)

