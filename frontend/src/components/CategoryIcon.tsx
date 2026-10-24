// src/components/CategoryIcon.tsx
// Las categorías guardan el ícono como string con nombres estilo Tabler
// ("shopping-cart", "device-gamepad", "dots-circle"...). Aquí se traducen
// a componentes de lucide-react, que es la librería que ya usa el frontend.
import {
  Home, ShoppingCart, Car, Zap, HeartPulse, BookOpen, Gamepad2, Shirt,
  Cpu, PiggyBank, CreditCard, MoreHorizontal, Circle, Target,
  Utensils, Coffee, Plane, Gift, Briefcase, Dumbbell, Wallet,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  // Categorías por defecto (categoryService.js)
  'home':           Home,
  'shopping-cart':  ShoppingCart,
  'car':            Car,
  'bolt':           Zap,
  'heart-pulse':    HeartPulse,
  'book':           BookOpen,
  'device-gamepad': Gamepad2,
  'shirt':          Shirt,
  'cpu':            Cpu,
  'piggy-bank':     PiggyBank,
  'credit-card':    CreditCard,
  'dots-circle':    MoreHorizontal,
  // Defaults del schema (Category.icon / Goal.icon)
  'circle':         Circle,
  'target':         Target,
  // Extras por si creas categorías personalizadas
  'utensils':       Utensils,
  'coffee':         Coffee,
  'plane':          Plane,
  'gift':           Gift,
  'briefcase':      Briefcase,
  'dumbbell':       Dumbbell,
  'wallet':         Wallet,
}

interface Props {
  icon?: string | null
  color?: string | null
  name?: string | null   // se usa para la inicial si el ícono no existe
  size?: 'sm' | 'md'
}

export default function CategoryIcon({ icon, color, name, size = 'md' }: Props) {
  const c = color || '#64748b'
  const box = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const iconSize = size === 'sm' ? 15 : 18
  const Icon = icon ? ICONS[icon] : undefined

  return (
    <div
      className={`${box} rounded-xl flex items-center justify-center shrink-0`}
      // color de la categoría al ~12% de opacidad como fondo
      style={{ backgroundColor: `${c}1F`, color: c }}
      aria-hidden="true"
    >
      {Icon
        ? <Icon size={iconSize} strokeWidth={2} />
        : <span className="text-sm font-semibold">{name?.[0]?.toUpperCase() || '?'}</span>}
    </div>
  )
}
