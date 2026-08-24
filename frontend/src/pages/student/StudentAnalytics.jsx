import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import api from '../../api/axios'

export default function StudentAnalytics() {
  const { user } = useAuth()
  const [classes, setClasses]               = useState([])
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [data, setData]                     = useState(null)
  const [loading, setLoading]               = useState(true)
  const [loadingData, setLoadingData]       = useState(false)

  useEffect(() => {
    api.get('/classes/enrolled')
      .then(res => {
        setClasses(res.data)
        if (res.data.length > 0) setSelectedClassId(res.data[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  const fetchAnalytics = useCallback(async () => {
    if (!selectedClassId || !user) return
    setLoadingData(true)
    try {
      const res = await api.get(`/analytics/student/${user.id}/class/${selectedClassId}`)
      setData(res.data)
    } catch { setData(null) }
    finally { setLoadingData(false) }
  }, [selectedClassId, user])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  if (loading) return <div className="text-slate-400 text-sm p-4">Loading…</div>

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Performance</h1>
        <p className="text-slate-500 text-sm mt-1">Detailed analytics across topics and assessments</p>
      </div>

      {/* Class selector */}
      {classes.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {classes.map(cls => (
            <button key={cls.id} onClick={() => setSelectedClassId(cls.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedClassId === cls.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
              }`}>
              {cls.name}
            </button>
          ))}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">Join a class to see your analytics.</p>
        </div>
      ) : loadingData ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : !data ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">Complete some assessments to see your analytics.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Key stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Overall',    value: data.overall_avg ? `${data.overall_avg}%` : '—' },
              { label: 'Attendance', value: `${data.attendance_pct}%` },
              { label: 'Tasks Done', value: `${data.task_completion_pct}%` },
              { label: 'Streak',     value: `🔥 ${data.streak}d` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
              </div>
            ))}
          </div>

          {/* Topic performance */}
          {data.topic_performance?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Topic Performance</h2>
              <div className="space-y-3">
                {data.topic_performance.map(t => (
                  <div key={t.topic}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-700">{t.topic}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          t.status === 'strong'      ? 'bg-green-100 text-green-700' :
                          t.status === 'needs_work'  ? 'bg-amber-100 text-amber-700' :
                                                       'bg-red-100 text-red-600'
                        }`}>
                          {t.status === 'strong' ? 'Strong' : t.status === 'needs_work' ? 'OK' : 'Weak'}
                        </span>
                      </div>
                      <span className={`text-sm font-semibold ${
                        t.avg_score >= 70 ? 'text-green-600' :
                        t.avg_score >= 50 ? 'text-amber-600' : 'text-red-600'
                      }`}>{t.avg_score}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          t.avg_score >= 70 ? 'bg-green-500' :
                          t.avg_score >= 50 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${t.avg_score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak topics callout */}
          {data.weak_topics?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              ⚠️ <strong>Focus areas:</strong>{' '}
              {data.weak_topics.join(', ')} — these topics need more practice.
            </div>
          )}

          {/* Assessment history */}
          {data.score_history?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Assessment History</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {data.score_history.map((r, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between">
                    <p className="text-sm text-slate-700">{r.assessment_title}</p>
                    <span className={`text-sm font-semibold ${
                      r.score_pct >= 70 ? 'text-green-600' :
                      r.score_pct >= 50 ? 'text-amber-600' : 'text-red-600'
                    }`}>{r.score_pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
