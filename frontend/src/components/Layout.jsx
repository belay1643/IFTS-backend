import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

const Layout = ({ children }) => {
  const { theme } = useSelector((s) => s.ui)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className={`min-h-screen relative overflow-x-hidden ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <div className="bg-shell" aria-hidden />
      <div className="shell-aurora" aria-hidden />
      <div className="shell-grid" aria-hidden />
      {theme === 'dark' && <div className="bg-orb -top-24 -left-24" aria-hidden />}
      {theme === 'dark' && <div className="bg-orb alt top-[18%] right-[-90px]" aria-hidden />}
      {theme === 'light' && <div className="shell-spotlight left-[6%] top-[10%]" aria-hidden />}
      {theme === 'light' && <div className="shell-spotlight alt right-[6%] top-[24%]" aria-hidden />}
      <Topbar />
      <div className="relative z-10 flex w-full max-w-full flex-col gap-4 px-2.5 py-3 sm:gap-5 sm:px-4 sm:py-4 lg:flex-row lg:px-6 xl:px-8 lg:py-6">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 min-w-0">
          <div className="surface-container w-full max-w-full">
            <main className="text-[color:var(--text-primary)] w-full max-w-full">{children}</main>
            <footer className="mt-6 border-t border-[color:var(--panel-border)]/80 px-1 pt-3 pb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--text-muted)] max-sm:justify-center max-sm:text-center">
              <span>© 2026 Ethio Vest</span>
              <span>System Status: All systems operational</span>
              <span>Version 1.0</span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Layout
