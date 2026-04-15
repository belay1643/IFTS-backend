import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api.js'

export const fetchCompanies = createAsyncThunk('company/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/companies', { params: { pageSize: 100 } })
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to load companies' })
  }
})

export const createCompany = createAsyncThunk('company/create', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/companies', payload)
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to create company' })
  }
})

export const updateCompany = createAsyncThunk('company/update', async ({ id, updates }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/companies/${id}`, updates)
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to update company' })
  }
})

const initialActive = typeof localStorage !== 'undefined' ? localStorage.getItem('activeCompanyId') : null

const companySlice = createSlice({
  name: 'company',
  initialState: {
    list: [],
    active: initialActive,
    status: 'idle',
    createStatus: 'idle',
    updateStatus: 'idle',
    error: null
  },
  reducers: {
    setActiveCompany: (state, action) => {
      state.active = action.payload
      if (typeof localStorage !== 'undefined') {
        if (action.payload) localStorage.setItem('activeCompanyId', action.payload)
        else localStorage.removeItem('activeCompanyId')
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanies.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchCompanies.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.error = null
        const companies = action.payload?.data || action.payload || []
        state.list = companies
        if (!state.active && companies.length > 0) {
          state.active = companies[0].id
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('activeCompanyId', companies[0].id)
          }
        }
      })
      .addCase(fetchCompanies.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload?.message || 'Failed to load companies'
      })
      .addCase(createCompany.pending, (state) => {
        state.createStatus = 'loading'
        state.error = null
      })
      .addCase(createCompany.fulfilled, (state, action) => {
        state.createStatus = 'succeeded'
        state.list.unshift(action.payload)
      })
      .addCase(createCompany.rejected, (state, action) => {
        state.createStatus = 'failed'
        state.error = action.payload?.message || 'Failed to create company'
      })
      .addCase(updateCompany.pending, (state) => {
        state.updateStatus = 'loading'
        state.error = null
      })
      .addCase(updateCompany.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded'
        const idx = state.list.findIndex((c) => c.id === action.payload.id)
        if (idx >= 0) state.list[idx] = { ...state.list[idx], ...action.payload }
      })
      .addCase(updateCompany.rejected, (state, action) => {
        state.updateStatus = 'failed'
        state.error = action.payload?.message || 'Failed to update company'
      })
  }
})

export const { setActiveCompany } = companySlice.actions
export default companySlice.reducer
