import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { label: 'Dashboard',    to: '/teacher' },
  { label: 'My Classes',   to: '/teacher/classes' },
  { label: 'Tasks',        to: '/teacher/tasks' },
  { label: 'Assessments',  to: '/teacher/assessments' },
  { label: 'Attendance',   to: '/teacher/attendance' },
  { label: 'Analytics',    to: '/teacher/analytics' },
  { label: 'Intervention', to: '/teacher/intervention' },
  { label: 'AI Assistant', to: '/teacher/ai' },
]

export default function TeacherLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200">
          <span className="text-lg font-bold text-blue-700">ShikshaFlow AI</span>
          <p className="text-xs text-slate-400 mt-0.5">Teacher Portal</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/teacher'}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${
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
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <span className="text-sm text-slate-500">Welcome back,</span>
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
    </div>
  )
}
