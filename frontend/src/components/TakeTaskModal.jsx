import { useState } from 'react'
import api from '../api/axios'

export default function TakeTaskModal({ task, onSubmitted, onClose }) {
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0) // question index

  const questions = task.questions || []
  const total = questions.length
  const current = questions[step]

  function setAnswer(qId, value) {
    setAnswers(prev => ({ ...prev, [String(qId)]: value }))
  }

  function canAdvance() {
    if (!current) return false
    if (current.type === 'short') return true // short answers optional until submit
    return answers[String(current.id)] !== undefined && answers[String(current.id)] !== ''
  }

  async function handleSubmit() {
    setError('')
    setSubmitting(true)
    try {
      const res = await api.post(`/tasks/${task.id}/submit`, {
        task_id: task.id,
        answers: JSON.stringify(answers),
      })
      const submissionId = res.data.id

      // If the task has short-answer questions, trigger AI evaluation
      const hasShort = questions.some(q => q.type === 'short')
      if (hasShort) {
        setSubmitting(false)
        setEvaluating(true)
        try {
          await api.post('/ai/evaluate-submission', { submission_id: submissionId })
        } catch {
          // Evaluation failed — still proceed, score may be null or partial
        }
        setEvaluating(false)
      }

      onSubmitted({ ...task, score: res.data.score, submission_id: submissionId })
    } catch (err) {
      setError(err.response?.data?.detail || 'Submission failed.')
      setSubmitting(false)
      setEvaluating(false)
    }
  }

  if (total === 0) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center">
          <p className="text-slate-500 text-sm mb-4">This task has no questions yet.</p>
          <button onClick={onClose} className="text-sm text-blue-600 hover:underline">Close</button>
        </div>
      </div>
    )
  }

  // Loading overlay during AI evaluation
  if (evaluating) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-10 text-center">
          <div className="text-4xl mb-4 animate-pulse">🤖</div>
          <p className="text-slate-700 font-semibold mb-1">Evaluating your answers…</p>
          <p className="text-slate-400 text-sm">IBM Granite is reviewing your short answers. This takes a moment.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{task.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{task.subject} · {task.topic} · {task.marks} marks</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Question {step + 1} of {total}</span>
            <span>{Math.round((step / total) * 100)}% done</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="px-6 py-5">
          <p className="font-medium text-slate-800 mb-4 leading-relaxed">{current.text}</p>

          {current.type === 'mcq' && (
            <div className="space-y-2">
              {(current.options || []).map((opt, i) => (
                <label
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    answers[String(current.id)] === opt
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${current.id}`}
                    value={opt}
                    checked={answers[String(current.id)] === opt}
                    onChange={() => setAnswer(current.id, opt)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {current.type === 'truefalse' && (
            <div className="flex gap-3">
              {['true', 'false'].map(val => (
                <label
                  key={val}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition capitalize ${
                    answers[String(current.id)] === val
                      ? 'border-blue-500 bg-blue-50 font-semibold text-blue-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${current.id}`}
                    value={val}
                    checked={answers[String(current.id)] === val}
                    onChange={() => setAnswer(current.id, val)}
                    className="hidden"
                  />
                  {val === 'true' ? '✓ True' : '✗ False'}
                </label>
              ))}
            </div>
          )}

          {current.type === 'short' && (
            <textarea
              value={answers[String(current.id)] || ''}
              onChange={e => setAnswer(current.id, e.target.value)}
              placeholder="Type your answer here…"
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          )}
        </div>

        {error && (
          <div className="mx-6 mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Navigation */}
        <div className="px-6 pb-5 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition"
            >
              ← Back
            </button>
          )}
          {step < total - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || evaluating}
              className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit Task ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
