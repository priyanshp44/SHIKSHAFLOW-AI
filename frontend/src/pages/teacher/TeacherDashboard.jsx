import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import api from '../../api/axios'

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/teacher')
      setData(res.data)
    } catch {
      // handled
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
      Loading dashboard…
    </div>
  )

  const d = data || {}

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          Welcome back, {user?.name} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">{user?.unique_id} · Teacher Portal</p>
      </div>

      {/* Overview stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Classes',           value: d.total_classes ?? '—' },
          { label: 'Students',          value: d.total_students ?? '—' },
          { label: 'Avg Score',         value: d.avg_score ? `${d.avg_score}%` : '—' },
          { label: 'Attendance',        value: d.attendance_pct ? `${d.attendance_pct}%` : '—' },
          { label: 'Needs Attention',   value: d.needs_attention ?? '—', alert: d.needs_attention > 0 },
        ].map(({ label, value, alert }) => (
          <div
            key={label}
            className={`bg-white rounded-xl border p-5 ${alert ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
          >
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-2 ${alert ? 'text-amber-600' : 'text-slate-800'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Needs attention banner */}
      {d.needs_attention > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800">
            ⚠️ <strong>{d.needs_attention} student{d.needs_attention !== 1 ? 's' : ''}</strong> across your classes need attention.
          </p>
          <div className="flex gap-3 flex-shrink-0">
            <Link to="/teacher/analytics" className="text-xs text-amber-700 font-semibold hover:underline">
              Analytics →
            </Link>
            <Link to="/teacher/intervention" className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 font-semibold transition">
              Intervene →
            </Link>
          </div>
        </div>
      )}

      {/* Classes list */}
      <h2 className="text-base font-semibold text-slate-700 mb-3">My Classes</h2>
      {(!d.classes || d.classes.length === 0) ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <p className="text-slate-400 text-sm">No classes yet.</p>
          <Link to="/teacher/classes" className="mt-2 inline-block text-blue-600 hover:underline text-sm font-medium">
            Create your first class →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {d.classes.map(cls => (
            <Link
              key={cls.id}
              to={`/teacher/classes/${cls.id}`}
              className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800">{cls.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{cls.subject} · {cls.student_count} students</p>
                </div>
                <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded">
                  {cls.class_id}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <Stat label="Avg Score"   value={cls.avg_score ? `${cls.avg_score}%` : '—'} />
                <Stat label="Attendance"  value={cls.attendance_pct ? `${cls.attendance_pct}%` : '—'} />
                <Stat label="Pending"     value={cls.pending_tasks} />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                {cls.weak_topic ? (
                  <span className="text-amber-600">⚠ Weak: <strong>{cls.weak_topic}</strong></span>
                ) : (
                  <span className="text-slate-400">No weak topics yet</span>
                )}
                {cls.needs_attention > 0 && (
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    {cls.needs_attention} need support
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-bold text-slate-800 mt-0.5">{value}</p>
    </div>
  )
}
