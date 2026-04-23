import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import DashboardPage from './pages/DashboardPage.jsx'
import InvestmentsPage from './pages/InvestmentsPage.jsx'
import TransactionsPage from './pages/TransactionsPage.jsx'
import CompaniesPage from './pages/CompaniesPage.jsx'
import CompanyFormPage from './pages/CompanyFormPage.jsx'
import CompanyProfilePage from './pages/CompanyProfilePage.jsx'
import ApprovalsPage from './pages/ApprovalsPage.jsx'
import ApprovalDetailPage from './pages/ApprovalDetailPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import ProfitLossReportPage from './pages/ProfitLossReportPage.jsx'
import ManagersPage from './pages/ManagersPage.jsx'
import AuditLogsPage from './pages/AuditLogsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import FeaturesPage from './pages/FeaturesPage.jsx'
import AboutPage from './pages/AboutPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import Layout from './components/Layout.jsx'
import { fetchCompanies } from './store/slices/companySlice.js'

const RequireAuth = ({ children }) => {
  const { accessToken } = useSelector((s) => s.auth)
  if (!accessToken) return <Navigate to="/login" replace />
  return children
}

const useActiveRole = () => {
  const { list, active } = useSelector((s) => s.company)
  return list.find((c) => c.id === active)?.role || 'viewer'
}

const RequireRole = ({ allowed, children }) => {
  const role = useActiveRole()
  if (!allowed.includes(role)) return <Navigate to="/dashboard" replace />
  return children
}

const App = () => {
  const dispatch = useDispatch()
  const { accessToken } = useSelector((s) => s.auth)

  useEffect(() => {
    if (accessToken) dispatch(fetchCompanies())
  }, [accessToken, dispatch])

  return (
    <Routes>
      <Route path="/" element={accessToken ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={accessToken ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={accessToken ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
      <Route path="/forgot" element={accessToken ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
      <Route path="/reset-password" element={accessToken ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Layout>
              <DashboardPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/companies"
        element={
          <RequireAuth>
            <Layout>
              <CompaniesPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/companies/new"
        element={
          <RequireAuth>
            <Layout>
              <CompanyFormPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/companies/:companyId/edit"
        element={
          <RequireAuth>
            <Layout>
              <CompanyFormPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/companies/:companyId"
        element={
          <RequireAuth>
            <Layout>
              <CompanyProfilePage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/investments"
        element={
          <RequireAuth>
            <Layout>
              <InvestmentsPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/transactions"
        element={
          <RequireAuth>
            <Layout>
              <TransactionsPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/approvals"
        element={
          <RequireAuth>
            <RequireRole allowed={['admin', 'manager']}>
              <Layout>
                <ApprovalsPage />
              </Layout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/approvals/:transactionId"
        element={
          <RequireAuth>
            <RequireRole allowed={['admin', 'manager']}>
              <Layout>
                <ApprovalDetailPage />
              </Layout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth>
            <Layout>
              <ReportsPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/reports/profit-loss"
        element={
          <RequireAuth>
            <Layout>
              <ProfitLossReportPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/managers"
        element={
          <RequireAuth>
            <RequireRole allowed={['admin', 'manager']}>
              <Layout>
                <ManagersPage />
              </Layout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/audit"
        element={
          <RequireAuth>
            <RequireRole allowed={['admin']}>
              <Layout>
                <AuditLogsPage />
              </Layout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <RequireRole allowed={['admin', 'manager']}>
              <Layout>
                <SettingsPage />
              </Layout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/notifications"
        element={
          <RequireAuth>
            <Layout>
              <NotificationsPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to={accessToken ? '/dashboard' : '/'} replace />} />
    </Routes>
  )
}

export default App
