import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api.js'

const recalcUnread = (items) => items.filter((n) => n.status === 'unread' || (!n.status && !n.isRead)).length

export const fetchNotifications = createAsyncThunk('notifications/fetch', async (params = {}) => {
  const { data } = await api.get('/notifications', { params })
  return data
})

export const markNotificationRead = createAsyncThunk('notifications/markRead', async (id) => {
  const { data } = await api.post(`/notifications/${id}/read`)
  return data
})

export const markNotificationUnread = createAsyncThunk('notifications/markUnread', async (id) => {
  const { data } = await api.post(`/notifications/${id}/unread`)
  return data
})

export const archiveNotification = createAsyncThunk('notifications/archive', async (id) => {
  const { data } = await api.post(`/notifications/${id}/archive`)
  return data
})

export const markAllNotificationsRead = createAsyncThunk('notifications/markAllRead', async () => {
  await api.post('/notifications/mark-all-read')
  return true
})

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    loading: false,
    error: null,
    unreadCount: 0
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
        state.unreadCount = recalcUnread(state.items)
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to load notifications'
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        state.items = state.items.map((n) => (n.id === action.payload.id ? action.payload : n))
        state.unreadCount = recalcUnread(state.items)
      })
      .addCase(markNotificationUnread.fulfilled, (state, action) => {
        state.items = state.items.map((n) => (n.id === action.payload.id ? action.payload : n))
        state.unreadCount = recalcUnread(state.items)
      })
      .addCase(archiveNotification.fulfilled, (state, action) => {
        state.items = state.items.map((n) => (n.id === action.payload.id ? action.payload : n))
        state.unreadCount = recalcUnread(state.items)
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items = state.items.map((n) => ({ ...n, status: 'read', isRead: true }))
        state.unreadCount = 0
      })
  }
})

export default notificationSlice.reducer
