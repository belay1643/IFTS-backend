import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api' })

// Pull token from localStorage to avoid circular store imports
api.interceptors.request.use((config) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  const activeCompany = typeof localStorage !== 'undefined' ? localStorage.getItem('activeCompanyId') : null
  if (activeCompany) config.headers['X-Company-Id'] = activeCompany
  return config
})

// Handle JWT expired globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isJwtExpired = error?.response?.status === 401 &&
      (error?.response?.data?.message?.toLowerCase().includes('jwt expired') ||
        error?.response?.data?.error?.toLowerCase().includes('jwt expired'))
    if (isJwtExpired) {
      // Remove tokens
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }
      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
