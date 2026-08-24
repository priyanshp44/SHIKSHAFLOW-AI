import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

export default function ClassAnalytics() {
  const [classes, setClasses]               = useState([])
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [data, setData]                     = useState(null)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingData, setLoadingData]       = useState(false)

  useEffect(() => {
    api.get('/classes/mine')
      .then(res => {
        setClasses(res.data)
        if (res.data.length > 0) setSelectedClassId(res.data[0].id)
      })
      .finally(() => setLoadingClasses(false))
  }, [])

  const fetchAnalytics = useCallback(async () => {
    if (!selectedClassId) return
    setLoadingData(true)
    try {
      const res = await api.get(`/analytics/class/${selectedClassId}`)
      setData(res.data)
    } catch { setData(null) }
    finally { setLoadingData(false) }
  }, [selectedClassId])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  if (loadingClasses) return <div className="text-slate-400 text-sm p-4">Loading…</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Class Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Performance breakdown and at-risk student detection</p>
      </div>

      {/* Class tabs */}
      {classes.length > 0 && (
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

      {loadingData ? (
        <div className="text-slate-400 text-sm">Loading analytics…</div>
      ) : !data ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">No data yet. Assign and complete assessments to see analytics.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Overview stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Students',       value: data.student_count },
              { label: 'Class Avg',      value: data.class_avg ? `${data.class_avg}%` : '—',
                color: data.class_avg >= 70 ? 'text-green-600' : data.class_avg >= 50 ? 'text-amber-600' : 'text-red-600' },
              { label: 'Avg Attendance', value: data.avg_attendance ? `${data.avg_attendance}%` : '—' },
              { label: 'At Risk',        value: data.at_risk_count,
                color: data.at_risk_count > 0 ? 'text-red-600' : 'text-green-600',
                bg: data.at_risk_count > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`bg-white border rounded-xl p-5 ${bg ?? 'border-slate-200'}`}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                <p className={`text-3xl font-bold mt-2 ${color ?? 'text-slate-800'}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Score distribution */}
          {(data.strong + data.average + data.needs_support) > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Score Distribution</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Strong (≥70%)',       value: data.strong,        cls: 'bg-green-50 border-green-200 text-green-700' },
                  { label: 'Average (50–69%)',     value: data.average,       cls: 'bg-amber-50 border-amber-200 text-amber-700' },
                  { label: 'Needs Support (<50%)', value: data.needs_support, cls: 'bg-red-50 border-red-200 text-red-700' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className={`border rounded-xl p-4 text-center ${cls}`}>
                    <p className="text-3xl font-bold">{value}</p>
                    <p className="text-xs mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Topic performance */}
          {Object.keys(data.topic_avgs || {}).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">Topic Performance</h2>
                <div className="flex gap-3 text-xs text-slate-500">
                  {data.strong_topic && <span>💪 Strong: <strong className="text-green-600">{data.strong_topic}</strong></span>}
                  {data.weak_topic   && <span>⚠ Weak: <strong className="text-red-600">{data.weak_topic}</strong></span>}
                </div>
              </div>
              <div className="space-y-3">
                {Object.entries(data.topic_avgs)
                  .sort((a, b) => a[1] - b[1])
                  .map(([topic, avg]) => (
                    <div key={topic}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700">{topic}</span>
                        <span className={`font-semibold ${avg >= 70 ? 'text-green-600' : avg >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {avg}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${avg >= 70 ? 'bg-green-500' : avg >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${avg}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* At-risk students */}
          {data.at_risk?.length > 0 && (
            <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-red-100 bg-red-50 flex items-center gap-2">
                <span className="text-red-600 font-semibold text-sm">⚠ Students Needing Support</span>
                <span className="text-xs bg-red-100 border border-red-200 text-red-700 px-2 py-0.5 rounded-full">
                  {data.at_risk.length}
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {data.at_risk.map(s => (
                  <div key={s.student_id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-slate-800 text-sm">{s.student_name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            s.risk_level === 'high'
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            {s.risk_level === 'high' ? '🔴 High' : '🟡 Medium'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mb-2">{s.unique_id}</p>
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span className={s.avg_score < 55 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                            Score: {s.avg_score || 0}%
                          </span>
                          <span className={s.attendance_pct < 80 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                            Attendance: {s.attendance_pct}%
                          </span>
                          <span className={s.task_completion_pct < 60 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                            Tasks: {s.task_completion_pct}%
                          </span>
                          <span className="text-slate-500">🔥 {s.streak}d streak</span>
                        </div>
                      </div>
                    </div>
                    {s.reasons?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.reasons.map(r => (
                          <span key={r} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.at_risk?.length === 0 && data.student_count > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center text-sm text-green-700">
              🎉 All students are on track. No one flagged for attention.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
