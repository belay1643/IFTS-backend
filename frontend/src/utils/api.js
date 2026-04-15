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

export default api
