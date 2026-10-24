const prisma = require('../config/prisma')
const KEYWORD_MAP = [
  { keywords: ['éxito','exito','carulla','jumbo','d1','ara','mercado','supermercado','rappi','domicilio'], category: 'Alimentación' },
  { keywords: ['uber','cabify','taxi','mio','sitp','transmilenio','gasolina','parqueadero','indriver'], category: 'Transporte' },
  { keywords: ['netflix','spotify','disney','prime','youtube','cine','gaming','steam'], category: 'Entretenimiento' },
  { keywords: ['farmacia','droguería','drogueria','médico','medico','clinica','hospital','eps'], category: 'Salud' },
  { keywords: ['electricaribe','epm','codensa','gas','agua','internet','claro','movistar','tigo','wom','arriendo'], category: 'Servicios' },
  { keywords: ['zara','falabella','ropa','zapatos','adidas','nike'], category: 'Ropa' },
  { keywords: ['amazon','apple','samsung','tecnología','tecnologia','computador','celular'], category: 'Tecnología' },
  { keywords: ['universidad','colegio','curso','udemy','platzi','educación','educacion','libro'], category: 'Educación' },
]
exports.autoDetectCategory = async (description, userId) => {
  if (!description) return null
  const lower = description.toLowerCase()
  const match = KEYWORD_MAP.find(({ keywords }) => keywords.some(kw => lower.includes(kw)))
  if (!match) return null
  const category = await prisma.category.findFirst({
    where: { name: { equals: match.category, mode: 'insensitive' }, OR: [{ userId }, { isDefault: true }] }
  })
  return category?.id || null
}
