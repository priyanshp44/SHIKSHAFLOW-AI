import { useState, useEffect } from 'react'
import api from '../api/axios'

export default function AssessmentAnalysisModal({ assessmentId, onClose }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/assessments/${assessmentId}/analysis`)
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [assessmentId])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{data?.assessment?.title ?? 'Assessment Analysis'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{data?.assessment?.class_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading analysis…</div>
        ) : !data ? (
          <div className="p-8 text-center text-slate-400 text-sm">Could not load data.</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Enrolled',   value: data.enrolled },
                { label: 'Submitted',  value: data.submitted, color: 'text-blue-700' },
                { label: 'Class Avg',  value: data.avg_score_pct != null ? `${data.avg_score_pct}%` : '—',
                  color: data.avg_score_pct >= 70 ? 'text-green-600' : data.avg_score_pct >= 50 ? 'text-amber-600' : 'text-red-600' },
                { label: 'Pending',    value: data.enrolled - data.submitted,
                  color: (data.enrolled - data.submitted) > 0 ? 'text-amber-600' : 'text-slate-800' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`text-2xl font-bold mt-1 ${color ?? 'text-slate-800'}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Distribution */}
            {data.submitted > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Score Distribution</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '≥ 70% — Strong',        value: data.strong,        color: 'bg-green-100 text-green-700 border-green-200' },
                    { label: '50–69% — Average',       value: data.average,       color: 'bg-amber-100 text-amber-700 border-amber-200' },
                    { label: '< 50% — Needs Support',  value: data.needs_support, color: 'bg-red-100 text-red-700 border-red-200' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`border rounded-xl p-3 text-center ${color}`}>
                      <p className="text-2xl font-bold">{value}</p>
                      <p className="text-xs mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Topic performance */}
            {Object.keys(data.topic_avgs || {}).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">By Topic</p>
                <div className="space-y-2">
                  {Object.entries(data.topic_avgs)
                    .sort((a, b) => a[1] - b[1])
                    .map(([topic, avg]) => (
                      <div key={topic}>
                        <div className="flex justify-between text-xs mb-1">
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
                    ))
                  }
                </div>
              </div>
            )}

            {/* Student scores */}
            {data.students.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Student Scores <span className="normal-case font-normal">(sorted: lowest first)</span>
                </p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.students.map((s, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-slate-800">{s.student_name}</p>
                            <p className="text-xs text-slate-400 font-mono">{s.student_uid}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm text-slate-600">
                            {s.score}/{s.max_score}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-semibold text-sm ${
                              s.score_pct >= 70 ? 'text-green-600' : s.score_pct >= 50 ? 'text-amber-600' : 'text-red-600'
                            }`}>{s.score_pct}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
