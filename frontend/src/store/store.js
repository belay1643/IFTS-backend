import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice.js'
import companyReducer from './slices/companySlice.js'
import dashboardReducer from './slices/dashboardSlice.js'
import investmentReducer from './slices/investmentSlice.js'
import transactionReducer from './slices/transactionSlice.js'
import approvalReducer from './slices/approvalSlice.js'
import uiReducer from './slices/uiSlice.js'
import notificationReducer from './slices/notificationSlice.js'

const store = configureStore({
  reducer: {
    auth: authReducer,
    company: companyReducer,
    dashboard: dashboardReducer,
    investments: investmentReducer,
    transactions: transactionReducer,
    approvals: approvalReducer,
    ui: uiReducer,
    notifications: notificationReducer
  }
})

export default store
