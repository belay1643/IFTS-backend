import { createSlice } from '@reduxjs/toolkit'

const safeLocalStorage = typeof window !== 'undefined' ? window.localStorage : null

const initialTheme = (() => {
  if (typeof window === 'undefined') return 'dark'
  const stored = safeLocalStorage?.getItem('ifts-theme')
  if (stored === 'light' || stored === 'dark') return stored
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
})()

const persistTheme = (theme) => {
  if (!safeLocalStorage) return
  try {
    safeLocalStorage.setItem('ifts-theme', theme)
  } catch (err) {
    console.warn('Unable to persist theme', err)
  }
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: initialTheme
  },
  reducers: {
    setTheme: (state, action) => {
      const next = action.payload === 'light' ? 'light' : 'dark'
      state.theme = next
      persistTheme(next)
    },
    toggleTheme: (state) => {
      const next = state.theme === 'light' ? 'dark' : 'light'
      state.theme = next
      persistTheme(next)
    }
  }
})

export const { setTheme, toggleTheme } = uiSlice.actions
export default uiSlice.reducer
