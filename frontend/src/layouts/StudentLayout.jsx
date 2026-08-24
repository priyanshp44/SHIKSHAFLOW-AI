import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { label: 'Dashboard',      to: '/student' },
  { label: 'My Classes',     to: '/student/classes' },
  { label: 'Tasks',          to: '/student/tasks' },
  { label: 'Assessments',    to: '/student/assessments' },
  { label: 'Attendance',     to: '/student/attendance' },
  { label: 'Analytics',      to: '/student/analytics' },
  { label: 'Learning Path',  to: '/student/recommendations' },
]

export default function StudentLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <span className="text-base font-bold text-blue-700">ShikshaFlow AI</span>
          <nav className="flex items-center gap-1">
            {navItems.map(({ label, to }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/student'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-700">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700 transition"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
