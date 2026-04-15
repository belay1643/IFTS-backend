import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api.js'

export const fetchSummary = createAsyncThunk('dashboard/fetchSummary', async ({ mode = 'single', companyIds }, { rejectWithValue }) => {
  try {
    const params = {}
    if (mode === 'consolidated') {
      if (!companyIds || companyIds.length === 0) throw new Error('No companies selected')
      params.companyIds = companyIds.join(',')
    } else if (companyIds && companyIds.length > 0) {
      params.companyId = companyIds[0]
    }
    const { data } = await api.get('/dashboard/summary', { params })
    return { data, mode }
  } catch (err) {
    const payload = err.response?.data || { message: err.message || 'Failed to load summary' }
    return rejectWithValue(payload)
  }
})

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: { summary: null, status: 'idle', error: null, mode: 'single' },
  reducers: {
    setDashboardMode: (state, action) => {
      state.mode = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSummary.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchSummary.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.summary = action.payload.data
        state.mode = action.payload.mode
      })
      .addCase(fetchSummary.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload?.message || 'Failed to load summary'
      })
  }
})

export const { setDashboardMode } = dashboardSlice.actions
export default dashboardSlice.reducer
