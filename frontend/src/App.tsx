// src/App.tsx  —  Fase 4 + Fitness
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'

import LoginPage        from './pages/LoginPage'
import RegisterPage     from './pages/RegisterPage'
import DashboardPage    from './pages/DashboardPage'
import TransactionsPage from './pages/TransactionsPage'
import BudgetsPage      from './pages/BudgetsPage'
import DebtsPage        from './pages/DebtsPage'
import NotificationsPage from './pages/NotificationsPage'
import ReportsPage      from './pages/ReportsPage'
import ImportPage       from './pages/ImportPage'
import GoalsPage        from './pages/GoalsPage'
import AlertsPage       from './pages/AlertsPage'
import StatsPage        from './pages/StatsPage'
import DevicePage       from './pages/DevicePage'
import DeployPage       from './pages/DeployPage'
import FitnessProfilePage  from './pages/FitnessProfilePage'
import ProgressPage        from './pages/ProgressPage'
import RoutinesPage        from './pages/RoutinesPage'
import WorkoutSessionPage  from './pages/WorkoutSessionPage'
import MealsPage                  from './pages/MealsPage'
import MealRecommendationsPage   from './pages/MealRecommendationsPage'
import ProductivityDashboardPage from './pages/ProductivityDashboardPage'
import TasksPage    from './pages/TasksPage'
import HabitsPage   from './pages/HabitsPage'
import RoutinePage  from './pages/RoutinePage'
import PomodoroPage from './pages/PomodoroPage'
import Layout           from './components/layout/Layout'
import RecordsPage from './pages/RecordsPage'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
})

const Protected = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { borderRadius: '10px', background: '#1E293B', color: '#fff', fontSize: '14px' },
            success: { iconTheme: { primary: '#0F6E56', secondary: '#fff' } }
          }}
        />
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={
            <Protected><Layout /></Protected>
          }>
            <Route index                element={<DashboardPage />} />
            <Route path="gastos"        element={<TransactionsPage />} />
            <Route path="presupuestos"  element={<BudgetsPage />} />
            <Route path="metas"         element={<GoalsPage />} />
            <Route path="importar"      element={<ImportPage />} />
            <Route path="reportes"      element={<ReportsPage />} />
            <Route path="notificaciones" element={<NotificationsPage />} />
            <Route path="deudas"        element={<DebtsPage />} />
            <Route path="estadisticas"  element={<StatsPage />} />
            <Route path="alertas"       element={<AlertsPage />} />
            <Route path="dispositivo"   element={<DevicePage />} />
            <Route path="deploy"        element={<DeployPage />} />

            {/* Fitness */}
            <Route path="fitness/perfil"   element={<FitnessProfilePage />} />
            <Route path="fitness/records" element={<RecordsPage />} />
            <Route path="fitness/progreso" element={<ProgressPage />} />
            <Route path="fitness/rutinas"  element={<RoutinesPage />} />
            <Route path="fitness/comidas"       element={<MealsPage />} />
            <Route path="productividad"          element={<ProductivityDashboardPage />} />
            <Route path="productividad/tareas"   element={<TasksPage />} />
            <Route path="productividad/habitos"  element={<HabitsPage />} />
            <Route path="productividad/rutina"   element={<RoutinePage />} />
            <Route path="productividad/pomodoro" element={<PomodoroPage />} />
            <Route path="fitness/recetas"      element={<MealRecommendationsPage />} />
            <Route path="entreno/:id"      element={<WorkoutSessionPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
            </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
