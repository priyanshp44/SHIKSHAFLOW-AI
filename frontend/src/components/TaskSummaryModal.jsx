import { useState, useEffect } from 'react'
import api from '../api/axios'

export default function TaskSummaryModal({ task, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/tasks/${task.id}/summary`)
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [task.id])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{task.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{task.subject} · {task.topic}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading submissions…</div>
        ) : !data ? (
          <div className="p-8 text-center text-slate-400 text-sm">Could not load data.</div>
        ) : (
          <div className="p-6">
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Assigned',  value: data.enrolled },
                { label: 'Submitted', value: data.submitted, color: 'text-green-700' },
                { label: 'Pending',   value: data.pending,   color: data.pending > 0 ? 'text-amber-600' : 'text-slate-800' },
                { label: 'Avg Score', value: data.avg_score != null ? `${data.avg_score}` : '—' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`text-xl font-bold mt-1 ${color || 'text-slate-800'}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Submission list */}
            {data.submissions.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-4">No submissions yet.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.submissions.map((s, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-800">{s.student_name}</p>
                          <p className="text-xs text-slate-400 font-mono">{s.student_unique_id}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`font-semibold ${
                            s.score == null ? 'text-slate-400' :
                            s.score < 5 ? 'text-red-600' :
                            s.score < 7 ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            {s.score != null ? `${s.score}/${data.task.marks}` : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          {new Date(s.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
