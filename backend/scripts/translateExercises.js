// Traduce al español name e instructions de los ejercicios importados.
// Uso: node scripts/translateExercises.js   (se puede volver a correr; retoma)
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b'
const LOTE = 4
const sleep = ms => new Promise(r => setTimeout(r, ms))

const SISTEMA = `Eres un traductor experto en entrenamiento de fuerza para hispanohablantes de Colombia.
Traduce al español nombres e instrucciones de ejercicios de gimnasio.
Reglas:
- Usa la terminología de gimnasios latinoamericanos: "Press de banca con barra", "Curl de bíceps con mancuerna", "Sentadilla con barra", "Remo con mancuerna", "Jalón al pecho", "Peso muerto rumano".
- Conserva términos que en el gym se dicen en inglés: press, curl, hip thrust, face pull, crunch, burpee, kettlebell, clean, hang clean, snatch, jerk, thruster, swing, windmill, good morning.
- NUNCA traduzcas "clean" como "limpiar/limpiadora" ni "hang" como "colgante": en instrucciones di "haz un clean" o "lleva la barra a los hombros con un clean".
- Nombres cortos, sin artículo al inicio, primera letra en mayúscula.
- Instrucciones claras en segunda persona (tú), con el mismo número de pasos que el original.
- Responde SOLO con JSON válido, sin texto adicional:
{"items":[{"id":"...","name":"...","instructions":["..."]}]}`

async function groq(messages, intento = 1) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.2, max_tokens: 2500 }),
  })
  if (res.status === 429 || res.status >= 500) {
    if (intento > 6) throw new Error(`Groq ${res.status} tras 6 intentos`)
    const espera = Math.ceil(Number(res.headers.get('retry-after')) || 20 * intento)
    console.log(`⏳ Groq ${res.status}, esperando ${espera}s...`)
    await sleep(espera * 1000)
    return groq(messages, intento + 1)
  }
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`)

  const data = await res.json()
  let txt = data.choices?.[0]?.message?.content || ''
  txt = txt.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json|```/g, '').trim()
  const ini = txt.indexOf('{'), fin = txt.lastIndexOf('}')
  return JSON.parse(txt.slice(ini, fin + 1))
}

async function main() {
  if (!process.env.GROQ_API_KEY) throw new Error('Falta GROQ_API_KEY en .env')
  const procesados = []
  let ok = 0, fallidos = 0

  while (true) {
    const lote = await prisma.exercise.findMany({
      where: {
        externalId: { not: null },
        instructions: { isEmpty: true },
        id: { notIn: procesados },
      },
      select: { id: true, name: true, nameEn: true, instructionsEn: true },
      take: LOTE,
    })
    if (lote.length === 0) break
    procesados.push(...lote.map(e => e.id))

    const entrada = lote.map(e => ({ id: e.id, name: e.nameEn, instructions: e.instructionsEn }))
    try {
      const out = await groq([
        { role: 'system', content: SISTEMA },
        { role: 'user', content: '/no_think\n' + JSON.stringify({ items: entrada }) },
      ])
      const porId = Object.fromEntries((out.items || []).map(i => [i.id, i]))

      for (const e of lote) {
        const t = porId[e.id]
        if (!t?.name || !Array.isArray(t.instructions)) { fallidos++; continue }
        await prisma.exercise.update({
          where: { id: e.id },
          data: { name: e.name === e.nameEn ? t.name.trim() : undefined, instructions: t.instructions.map(s => String(s).trim()) },
        })
        ok++
      }
    } catch (err) {
      fallidos += lote.length
      console.log(`⚠️  Lote fallido: ${err.message}`)
    }

    console.log(`✅ ${ok} traducidos | ❌ ${fallidos} fallidos`)
    await sleep(25000)
  }

  const pendientes = await prisma.exercise.count({
    where: { externalId: { not: null }, instructions: { isEmpty: true } },
  })
  console.log(`\n🏁 Terminado. Traducidos: ${ok} | Fallidos: ${fallidos} | Pendientes: ${pendientes}`)
  if (pendientes) console.log('   Vuelve a correr el script para reintentar los pendientes.')
}

main()
  .catch(e => { console.error('❌', e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
