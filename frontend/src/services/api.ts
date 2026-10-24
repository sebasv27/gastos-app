// src/services/api.ts
import axios from 'axios'

// En desarrollo: proxy de Vite (/api → localhost:4000)
// En producción: VITE_API_URL = https://tu-backend.railway.app
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  register: (data: { name: string; email: string; password: string; monthlyIncome?: number }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data: Partial<{ name: string; monthlyIncome: number; pushToken: string }>) =>
    api.put('/auth/profile', data),
}

export const transactionApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/transactions', { params }),
  create: (data: Record<string, unknown>) => api.post('/transactions', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/transactions/${id}`, data),
  remove: (id: string) => api.delete(`/transactions/${id}`),
  exportCSV: (params?: Record<string, string | number>) =>
    api.get('/transactions/export', { params, responseType: 'blob' }),
}

export const dashboardApi = {
  getSummary: (month?: number, year?: number) =>
    api.get('/dashboard', { params: { month, year } }),
  getTrend: () => api.get('/dashboard/trend'),
}

export const budgetApi = {
  list: (month?: number, year?: number) =>
    api.get('/budgets', { params: { month, year } }),
  upsert: (data: Record<string, unknown>) => api.post('/budgets', data),
  remove: (id: string) => api.delete(`/budgets/${id}`),
}

export const categoryApi = {
  list: () => api.get('/categories'),
  create: (data: { name: string; icon?: string; color?: string }) =>
    api.post('/categories', data),
}

export const goalApi = {
  list: () => api.get('/goals'),
  create: (data: Record<string, unknown>) => api.post('/goals', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/goals/${id}`, data),
  remove: (id: string) => api.delete(`/goals/${id}`),
}

export const alertApi = {
  list: () => api.get('/alerts'),
  markRead: (id: string) => api.put(`/alerts/${id}/read`),
  markAllRead: () => api.put('/alerts/read-all'),
}

export const ocrApi = {
  scanReceipt: (file: File) => {
    const form = new FormData()
    form.append('receipt', file)
    return api.post('/ocr/receipt', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  suggestCategory: (description: string) =>
    api.post('/ocr/suggest-category', { description }),
}

export default api

export const fitnessProfileApi = {
  get: () => api.get('/fitness-profile'),
  upsert: (data: Record<string, unknown>) => api.put('/fitness-profile', data),
  recalculate: () => api.post('/fitness-profile/recalculate'),
}

export const bodyLogApi = {
  list: (days?: number) => api.get('/body-logs', { params: { days } }),
  getProgress: (days?: number) => api.get('/body-logs/progress', { params: { days } }),
  create: (data: Record<string, unknown>) => api.post('/body-logs', data),
  remove: (id: string) => api.delete(`/body-logs/${id}`),
}

export const exerciseApi = {
  list: (params?: string | Record<string, string | number | undefined>) =>
    api.get('/exercises', { params: typeof params === 'string' ? { muscleGroup: params } : params }),
  get: (id: string) => api.get(`/exercises/${id}`),
  meta: () => api.get('/exercises/meta'),
  records: () => api.get('/exercises/records'),
  create: (data: { name: string; muscleGroup: string; equipment?: string }) =>
    api.post('/exercises', data),
  getHistory: (id: string, limit?: number) => api.get(`/exercises/${id}/history`, { params: { limit } }),
  remove: (id: string) => api.delete(`/exercises/${id}`),
}

export const routineApi = {
  list: () => api.get('/routines'),
  getOne: (id: string) => api.get(`/routines/${id}`),
  create: (data: Record<string, unknown>) => api.post('/routines', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/routines/${id}`, data),
  remove: (id: string) => api.delete(`/routines/${id}`),
  duplicate: (id: string) => api.post(`/routines/${id}/duplicate`),
}

export const workoutSessionApi = {
  list: (params?: Record<string, string | number>) => api.get('/workout-sessions', { params }),
  getOne: (id: string) => api.get(`/workout-sessions/${id}`),
  start: (data: { routineId?: string; name?: string; bodyweightKg?: number }) =>
    api.post('/workout-sessions', data),
  finish: (id: string, notes?: string) => api.put(`/workout-sessions/${id}/finish`, { notes }),
  remove: (id: string) => api.delete(`/workout-sessions/${id}`),
  addSet: (sessionId: string, data: Record<string, unknown>) =>
    api.post(`/workout-sessions/${sessionId}/sets`, data),
  updateSet: (sessionId: string, setId: string, data: Record<string, unknown>) =>
    api.put(`/workout-sessions/${sessionId}/sets/${setId}`, data),
  removeSet: (sessionId: string, setId: string) =>
    api.delete(`/workout-sessions/${sessionId}/sets/${setId}`),
  getVolumeTrend: (weeks?: number) => api.get('/workout-sessions/volume-trend', { params: { weeks } }),
}

export const mealApi = {
  list: (params?: Record<string, string>) => api.get('/meals', { params }),
  create: (data: Record<string, unknown>) => api.post('/meals', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/meals/${id}`, data),
  remove: (id: string) => api.delete(`/meals/${id}`),
  getTodaySummary: () => api.get('/meals/today-summary'),
  scanPhoto: (file: File) => {
    const form = new FormData()
    form.append('photo', file)
    return api.post('/meals/scan', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  estimateFromText: (description: string) => api.post('/meals/estimate', { description }),
}

export const mealRecommendationApi = {
  get: (params: { mode: 'complete_day' | 'full_plan'; style: 'colombian' | 'flexible' | 'both' }) =>
    api.post('/meal-recommendations', params),
}
