import { useState, useEffect } from 'react'
import api from '../api/axios'

export default function AssessmentResultModal({ assessment, onClose }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/assessments/${assessment.id}/my-result`)
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [assessment.id])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{assessment.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Your Result</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading result…</div>
        ) : !data ? (
          <div className="p-8 text-center text-slate-400 text-sm">Could not load result.</div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Score hero */}
            <div className="text-center p-5 bg-slate-50 rounded-xl border border-slate-200">
              <p className={`text-5xl font-bold mb-1 ${
                data.score_pct >= 70 ? 'text-green-600' :
                data.score_pct >= 50 ? 'text-amber-500' : 'text-red-600'
              }`}>{data.score_pct}%</p>
              <p className="text-slate-500 text-sm">
                {data.score} / {data.max_score} correct ·{' '}
                {data.score_pct >= 70 ? '🎉 Great job!' :
                 data.score_pct >= 50 ? '👍 Keep going' : '📚 Review needed'}
              </p>
            </div>

            {/* Topic breakdown */}
            {Object.keys(data.topic_scores || {}).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">By Topic</p>
                <div className="space-y-2">
                  {Object.entries(data.topic_scores)
                    .sort((a, b) => a[1] - b[1])
                    .map(([topic, pct]) => (
                      <div key={topic}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-700">{topic}</span>
                          <span className={`font-semibold ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Weak topics hint */}
            {Object.entries(data.topic_scores || {}).some(([, v]) => v < 60) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                ⚠️ <strong>Weak areas:</strong>{' '}
                {Object.entries(data.topic_scores)
                  .filter(([, v]) => v < 60)
                  .map(([t]) => t)
                  .join(', ')}
                . Review these topics and try again.
              </div>
            )}

            {data.feedback && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                💡 {data.feedback}
              </div>
            )}

            <p className="text-xs text-center text-slate-400">
              Submitted {new Date(data.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
