import { useState, useEffect } from 'react'
import api from '../api/axios'

export default function TaskResultModal({ task, onClose }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/tasks/${task.id}/my-submission`)
      .then(res => setResult(res.data))
      .catch(() => setResult(null))
      .finally(() => setLoading(false))
  }, [task.id])

  // Parse per-question AI feedbacks from submission feedback string
  // Format stored: "Q1: feedback text\nQ2: feedback text"
  function parseFeedbacks(feedbackStr) {
    if (!feedbackStr) return {}
    const map = {}
    feedbackStr.split('\n').forEach(line => {
      const m = line.match(/^Q(\d+):\s*(.+)/)
      if (m) map[m[1]] = m[2]
    })
    return map
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{task.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Result</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading result…</div>
        ) : !result ? (
          <div className="p-8 text-center text-slate-400 text-sm">Could not load result.</div>
        ) : (
          <div className="p-6">
            {/* Score hero */}
            <div className="text-center mb-6 p-5 bg-slate-50 rounded-xl border border-slate-200">
              {result.score != null ? (
                <>
                  <p className={`text-5xl font-bold mb-1 ${
                    result.score / result.marks >= 0.7 ? 'text-green-600' :
                    result.score / result.marks >= 0.5 ? 'text-amber-500' : 'text-red-600'
                  }`}>
                    {result.score}/{result.marks}
                  </p>
                  <p className="text-slate-500 text-sm">
                    {Math.round((result.score / result.marks) * 100)}% · {
                      result.score / result.marks >= 0.7 ? 'Good work!' :
                      result.score / result.marks >= 0.5 ? 'Keep practising' : 'Needs improvement'
                    }
                  </p>
                </>
              ) : (
                <p className="text-slate-500 text-sm">Score pending AI evaluation</p>
              )}
            </div>

            {/* Per-question breakdown */}
            {(() => {
              const feedbackMap = parseFeedbacks(result.feedback)
              return (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Question Breakdown</p>
                  {result.question_results.map((q, i) => {
                    const aiFeedback = feedbackMap[q.id]
                    return (
                      <div key={q.id} className={`p-3 rounded-xl border text-sm ${
                        q.is_correct === true ? 'border-green-200 bg-green-50' :
                        q.is_correct === false ? 'border-red-200 bg-red-50' :
                        'border-slate-200 bg-white'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-slate-800 flex-1">
                            <span className="text-slate-400 mr-1">Q{i + 1}.</span>
                            {q.text}
                          </p>
                          {q.is_correct !== null && (
                            <span className={`flex-shrink-0 text-xs font-bold ${q.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                              {q.is_correct ? '✓' : '✗'}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs space-y-1">
                          <p className="text-slate-600">
                            Your answer: <span className="font-medium">{q.your_answer || '—'}</span>
                          </p>
                          {q.is_correct === false && q.correct_answer && (
                            <p className="text-green-700">
                              Correct: <span className="font-medium">{q.correct_answer}</span>
                            </p>
                          )}
                          {q.type === 'short' && aiFeedback && (
                            <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
                              <span className="font-semibold">AI Feedback: </span>{aiFeedback}
                            </div>
                          )}
                          {q.type === 'short' && !aiFeedback && (
                            <p className="text-slate-400 italic">AI feedback not available</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
