import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import api from '../../api/axios'

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/student')
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
  const firstClass = d.classes?.[0]

  return (
    <div className="max-w-3xl">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          Hello, {user?.name} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">{user?.unique_id} · Student Portal</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Streak</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">🔥 {d.streak ?? 0}d</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tasks Done</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">{d.tasks_done ?? 0}/{d.tasks_total ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Overall</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">{d.overall_avg ? `${d.overall_avg}%` : '—'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Classes</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">{d.classes?.length ?? 0}</p>
        </div>
      </div>

      {/* No classes yet */}
      {(!d.classes || d.classes.length === 0) && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center mb-6">
          <p className="text-slate-400 text-sm">You haven't joined any classes yet.</p>
          <Link to="/student/classes" className="mt-2 inline-block text-blue-600 hover:underline text-sm font-medium">
            Join a class →
          </Link>
        </div>
      )}

      {/* Progress bar */}
      {d.overall_avg > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-slate-700">My Progress</span>
            <span className="font-bold text-slate-800">{d.overall_avg}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${d.overall_avg < 50 ? 'bg-red-400' : d.overall_avg < 70 ? 'bg-amber-400' : 'bg-green-500'}`}
              style={{ width: `${d.overall_avg}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
        {/* Today's Tasks */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Tasks</h2>
            <Link to="/student/tasks" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {firstClass?.tasks?.length > 0 ? (
              firstClass.tasks.slice(0, 5).map(t => (
                <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{t.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t.topic}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    t.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {t.status === 'completed' ? (t.score != null ? `${t.score}` : '✓') : 'Pending'}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-5 py-6 text-center text-slate-400 text-sm">No tasks assigned yet.</div>
            )}
          </div>
        </div>

        {/* Weak Topics + Recommendations */}
        <div className="space-y-4">
          {d.weak_topics?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Weak Topics</h2>
              <div className="flex flex-wrap gap-2">
                {d.weak_topics.map(t => (
                  <span key={t} className="text-xs bg-red-50 text-red-600 border border-red-100 px-3 py-1 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {d.recommendations?.length > 0 ? (
            <div className="bg-white border border-blue-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-800">Learning Path</h2>
                <Link to="/student/recommendations" className="text-xs text-blue-600 hover:underline">View full →</Link>
              </div>
              <ol className="space-y-2">
                {d.recommendations.slice(0, 4).map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {(r.step ?? i + 1)}
                    </span>
                    <span className="text-slate-700">{r.topic || (typeof r === 'string' ? r : JSON.stringify(r))}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-sm text-slate-500">No learning path yet</p>
              <button
                onClick={() => navigate('/student/recommendations')}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                ✨ Generate my learning path →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* My Classes */}
      {d.classes?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">My Classes</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {d.classes.map(cls => (
              <div key={cls.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{cls.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {cls.subject} · Teacher: {cls.teacher_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">
                    {cls.avg_score ? `${cls.avg_score}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-400">avg score</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
