import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api.js'

export const fetchApprovals = createAsyncThunk('approvals/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/approvals')
    return data
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Failed to load approvals' })
  }
})

export const decideApproval = createAsyncThunk(
  'approvals/decide',
  async ({ transactionId, decision, rationale }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/approvals/${transactionId}/decision`, { decision, rationale })
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: 'Failed to submit decision' })
    }
  }
)

const approvalSlice = createSlice({
  name: 'approvals',
  initialState: {
    items: [],
    status: 'idle',
    decideStatus: 'idle',
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchApprovals.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchApprovals.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchApprovals.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload?.message || 'Failed to load approvals'
      })
      .addCase(decideApproval.pending, (state) => {
        state.decideStatus = 'loading'
      })
      .addCase(decideApproval.fulfilled, (state, action) => {
        state.decideStatus = 'succeeded'
        const { approval, transaction } = action.payload
        const updated = { ...approval, Transaction: transaction }
        const idx = state.items.findIndex((a) => a.transactionId === approval.transactionId)
        if (idx >= 0) state.items[idx] = updated
        else state.items.unshift(updated)
      })
      .addCase(decideApproval.rejected, (state, action) => {
        state.decideStatus = 'failed'
        state.error = action.payload?.message || 'Failed to submit decision'
      })
  }
})

export default approvalSlice.reducer
