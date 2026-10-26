// src/components/layout/Layout.tsx  —  Fase 4 + Fitness
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Wallet,
  Target, Bell, BarChart2, LogOut, Menu, Smartphone, Rocket,
  Dumbbell, ChevronDown, UserCircle, TrendingUp, ClipboardList, UtensilsCrossed, Sparkles, BookMarked, CheckSquare, Flame, Clock, Timer, Trophy, Landmark, BellRing, FileText, Upload } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { alertApi } from '../../services/api'
import { Alert } from '../../types'
import ThemeToggle from './ThemeToggle'

const MAIN_NAV = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/gastos',        icon: ArrowLeftRight,  label: 'Gastos' },
  { to: '/importar',      icon: Upload,           label: 'Importar extracto' },
  { to: '/presupuestos',  icon: Wallet,           label: 'Presupuestos' },
  { to: '/metas',         icon: Target,           label: 'Metas' },
  { to: '/deudas',        icon: Landmark,         label: 'Deudas' },
  { to: '/estadisticas',  icon: BarChart2,        label: 'Estadísticas' },
  { to: '/reportes',      icon: FileText,         label: 'Reportes' },
  { to: '/alertas',       icon: Bell,             label: 'Alertas', badge: true },
]

const PRODUCTIVITY_NAV = [
  { to: '/productividad',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/productividad/tareas',   icon: CheckSquare,     label: 'Tareas' },
  { to: '/productividad/habitos',  icon: Flame,           label: 'Hábitos' },
  { to: '/productividad/rutina',   icon: Clock,           label: 'Rutina' },
  { to: '/productividad/pomodoro', icon: Timer,           label: 'Pomodoro' },
]

const FITNESS_NAV = [
  { to: '/fitness/perfil',   icon: UserCircle,       label: 'Perfil y Macros' },
  { to: '/fitness/progreso', icon: TrendingUp,        label: 'Progreso' },
  { to: '/fitness/rutinas',  icon: ClipboardList,     label: 'Rutinas' },
  { to: '/fitness/records',  icon: Trophy,     label: 'Mis récords' },
  { to: '/fitness/comidas',   icon: UtensilsCrossed,   label: 'Comidas' },
  { to: '/fitness/recetas',   icon: Sparkles,          label: 'Recetas IA' },
]

const SYSTEM_NAV = [
  { to: '/notificaciones',   icon: BellRing,       label: 'Notificaciones' },
  { to: '/dispositivo',   icon: Smartphone,       label: 'Dispositivo' },
  { to: '/deploy',        icon: Rocket,           label: 'Deploy' },
]

export default function Layout() {
  const [open, setOpen]    = useState(false)
  const { user, logout }   = useAuthStore()
  const navigate           = useNavigate()
  const location            = useLocation()
  const [fitnessOpen, setFitnessOpen] = useState(location.pathname.startsWith('/fitness') || location.pathname.startsWith('/entreno'))
  const [prodOpen, setProdOpen] = useState(location.pathname.startsWith('/productividad'))

  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn:  () => alertApi.list().then(r => r.data),
    refetchInterval: 60_000
  })
  const unread = (alertsData?.data || []).filter((a: Alert) => !a.isRead).length

  const handleLogout = () => { logout(); navigate('/login') }

  const initials = (name: string) =>
    name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
     ${isActive
       ? 'bg-brand-600 text-white font-medium'
       : 'text-white/60 hover:bg-white/10 hover:text-white'}`

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-sm shrink-0">$</div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-none truncate">Control Gastos</p>
            <p className="text-white/40 text-xs mt-0.5 truncate">{user?.name}</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {MAIN_NAV.map(({ to, icon: Icon, label, badge }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={linkClass}>
            <Icon size={17} />
            <span className="flex-1">{label}</span>
            {badge && unread > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </NavLink>
        ))}

        {/* Productividad collapsible section */}
          <div>
            <button onClick={() => setProdOpen(o => !o)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full text-white/60 hover:bg-white/10 hover:text-white transition-all">
              <LayoutDashboard size={17} />
              <span className="flex-1 text-left font-medium">Productividad</span>
              <ChevronDown size={14} className={`transition-transform ${prodOpen ? 'rotate-180' : ''}`} />
            </button>
            {prodOpen && (
              <div className="ml-3 mt-1 space-y-0.5">
                {PRODUCTIVITY_NAV.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <Icon size={15} />{label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Fitness collapsible section */}
        <div className="pt-2">
          <button onClick={() => setFitnessOpen(o => !o)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full text-white/60 hover:bg-white/10 hover:text-white transition-all">
            <Dumbbell size={17} />
            <span className="flex-1 text-left font-medium">Fitness</span>
            <ChevronDown size={14} className={`transition-transform ${fitnessOpen ? 'rotate-180' : ''}`} />
          </button>
          {fitnessOpen && (
            <div className="ml-2 pl-3 border-l border-white/10 space-y-0.5 mt-0.5">
              {FITNESS_NAV.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} onClick={() => setOpen(false)} className={linkClass}>
                  <Icon size={15} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 mt-2 border-t border-white/10">
          {SYSTEM_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={linkClass}>
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <ThemeToggle />
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.name ? initials(user.name) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">{user?.name}</p>
            <p className="text-white/40 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-all w-full">
          <LogOut size={16} />Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-dark shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-56 bg-dark z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-slate-100">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-dark text-sm">Control Gastos</span>
          <NavLink to="/alertas" className="relative p-1.5 rounded-lg hover:bg-slate-100">
            <Bell size={20} className="text-slate-600" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unread}
              </span>
            )}
          </NavLink>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
