import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api.js'

export const fetchTransactions = createAsyncThunk('transactions/fetchAll', async (companyId, { rejectWithValue }) => {
  try {
    const params = companyId ? { companyId } : {}
    const { data } = await api.get('/transactions', { params })
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to load transactions' })
  }
})

export const fetchTransactionMetrics = createAsyncThunk('transactions/fetchMetrics', async (companyId, { rejectWithValue }) => {
  try {
    const params = companyId ? { companyId } : {}
    const { data } = await api.get('/transactions/metrics', { params })
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to load transaction metrics' })
  }
})

export const createTransaction = createAsyncThunk('transactions/create', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/transactions', payload)
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to create transaction' })
  }
})

export const updateTransaction = createAsyncThunk('transactions/update', async ({ id, updates }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/transactions/${id}`, updates)
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to update transaction' })
  }
})

export const deleteTransaction = createAsyncThunk('transactions/delete', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/transactions/${id}`)
    return id
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to delete transaction' })
  }
})

const transactionSlice = createSlice({
  name: 'transactions',
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
      .addCase(fetchTransactions.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload?.message || 'Failed to load transactions'
      })
      .addCase(fetchTransactionMetrics.pending, (state) => {
        state.metricsStatus = 'loading'
      })
      .addCase(fetchTransactionMetrics.fulfilled, (state, action) => {
        state.metricsStatus = 'succeeded'
        state.metrics = action.payload
      })
      .addCase(fetchTransactionMetrics.rejected, (state, action) => {
        state.metricsStatus = 'failed'
        state.error = action.payload?.message || 'Failed to load transaction metrics'
      })
      .addCase(createTransaction.pending, (state) => {
        state.createStatus = 'loading'
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.createStatus = 'succeeded'
        state.items.unshift(action.payload)
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.createStatus = 'failed'
        state.error = action.payload?.message || 'Failed to create transaction'
      })
      .addCase(updateTransaction.pending, (state) => {
        state.updateStatus = 'loading'
      })
      .addCase(updateTransaction.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded'
        const idx = state.items.findIndex((t) => t.id === action.payload.id)
        if (idx >= 0) state.items[idx] = action.payload
      })
      .addCase(updateTransaction.rejected, (state, action) => {
        state.updateStatus = 'failed'
        state.error = action.payload?.message || 'Failed to update transaction'
      })
      .addCase(deleteTransaction.pending, (state) => {
        state.deleteStatus = 'loading'
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded'
        state.items = state.items.filter((t) => t.id !== action.payload)
      })
      .addCase(deleteTransaction.rejected, (state, action) => {
        state.deleteStatus = 'failed'
        state.error = action.payload?.message || 'Failed to delete transaction'
      })
  }
})

export default transactionSlice.reducer
