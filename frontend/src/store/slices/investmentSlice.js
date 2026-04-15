import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api.js'

export const fetchInvestments = createAsyncThunk('investments/fetchAll', async (companyId, { rejectWithValue }) => {
  try {
    const params = companyId ? { companyId } : {}
    const { data } = await api.get('/investments', { params })
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to load investments' })
  }
})

export const fetchInvestmentMetrics = createAsyncThunk('investments/fetchMetrics', async (companyId, { rejectWithValue }) => {
  try {
    const params = companyId ? { companyId } : {}
    const { data } = await api.get('/investments/metrics', { params })
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to load metrics' })
  }
})

export const createInvestment = createAsyncThunk('investments/create', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/investments', payload)
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to create investment' })
  }
})

export const updateInvestment = createAsyncThunk('investments/update', async ({ id, updates }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/investments/${id}`, updates)
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to update investment' })
  }
})

export const deleteInvestment = createAsyncThunk('investments/delete', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/investments/${id}`)
    return id
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to delete investment' })
  }
})

const investmentSlice = createSlice({
  name: 'investments',
  initialState: {
    items: [],
    metrics: null,
    status: 'idle',
    metricsStatus: 'idle',
    createStatus: 'idle',
    updateStatus: 'idle',
    deleteStatus: 'idle',
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvestments.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchInvestments.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchInvestments.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload?.message || 'Failed to load investments'
      })
      .addCase(fetchInvestmentMetrics.pending, (state) => {
        state.metricsStatus = 'loading'
      })
      .addCase(fetchInvestmentMetrics.fulfilled, (state, action) => {
        state.metricsStatus = 'succeeded'
        state.metrics = action.payload
      })
      .addCase(fetchInvestmentMetrics.rejected, (state, action) => {
        state.metricsStatus = 'failed'
        state.error = action.payload?.message || 'Failed to load metrics'
      })
      .addCase(createInvestment.pending, (state) => {
        state.createStatus = 'loading'
      })
      .addCase(createInvestment.fulfilled, (state, action) => {
        state.createStatus = 'succeeded'
        state.items.unshift(action.payload)
      })
      .addCase(createInvestment.rejected, (state, action) => {
        state.createStatus = 'failed'
        state.error = action.payload?.message || 'Failed to create investment'
      })
      .addCase(updateInvestment.pending, (state) => {
        state.updateStatus = 'loading'
      })
      .addCase(updateInvestment.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded'
        const idx = state.items.findIndex((i) => i.id === action.payload.id)
        if (idx >= 0) state.items[idx] = action.payload
      })
      .addCase(updateInvestment.rejected, (state, action) => {
        state.updateStatus = 'failed'
        state.error = action.payload?.message || 'Failed to update investment'
      })
      .addCase(deleteInvestment.pending, (state) => {
        state.deleteStatus = 'loading'
      })
      .addCase(deleteInvestment.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded'
        state.items = state.items.filter((i) => i.id !== action.payload)
      })
      .addCase(deleteInvestment.rejected, (state, action) => {
        state.deleteStatus = 'failed'
        state.error = action.payload?.message || 'Failed to delete investment'
      })
  }
})

export default investmentSlice.reducer
