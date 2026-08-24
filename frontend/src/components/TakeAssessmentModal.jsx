import { useState } from 'react'
import api from '../api/axios'

export default function TakeAssessmentModal({ assessment, onSubmitted, onClose }) {
  const [answers, setAnswers]   = useState({})
  const [step, setStep]         = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  const questions = assessment.questions || []
  const total     = questions.length
  const current   = questions[step]

  function setAnswer(qId, value) {
    setAnswers(prev => ({ ...prev, [String(qId)]: value }))
  }

  function canAdvance() {
    if (!current) return false
    if (current.type === 'short') return true
    return !!answers[String(current.id)]
  }

  async function handleSubmit() {
    setError('')
    setSubmitting(true)
    try {
      const res = await api.post(`/assessments/${assessment.id}/submit`, { answers })
      const scorePct = res.data.max_score > 0
        ? Math.round(res.data.score / res.data.max_score * 100)
        : 0
      onSubmitted(scorePct)
    } catch (err) {
      setError(err.response?.data?.detail || 'Submission failed.')
      setSubmitting(false)
    }
  }

  if (total === 0) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center">
        <p className="text-slate-500 text-sm mb-4">This assessment has no questions yet.</p>
        <button onClick={onClose} className="text-sm text-blue-600 hover:underline">Close</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{assessment.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{assessment.class_name} · {assessment.type}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Question {step + 1} of {total}</span>
            <span>{Math.round((step / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${((step + 1) / total) * 100}%` }} />
          </div>
        </div>

        {/* Question body */}
        <div className="px-6 py-5">
          {current.topic && (
            <span className="inline-block mb-2 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
              {current.topic}
            </span>
          )}
          <p className="font-medium text-slate-800 mb-4 leading-relaxed">{current.text}</p>

          {current.type === 'mcq' && (
            <div className="space-y-2">
              {(current.options || []).map((opt, i) => (
                <label key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    answers[String(current.id)] === opt
                      ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <input type="radio" name={`q-${current.id}`} value={opt}
                    checked={answers[String(current.id)] === opt}
                    onChange={() => setAnswer(current.id, opt)}
                    className="accent-blue-600" />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {current.type === 'truefalse' && (
            <div className="flex gap-3">
              {['true', 'false'].map(val => (
                <label key={val}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition capitalize ${
                    answers[String(current.id)] === val
                      ? 'border-blue-500 bg-blue-50 font-semibold text-blue-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}>
                  <input type="radio" name={`q-${current.id}`} value={val}
                    checked={answers[String(current.id)] === val}
                    onChange={() => setAnswer(current.id, val)} className="hidden" />
                  {val === 'true' ? '✓ True' : '✗ False'}
                </label>
              ))}
            </div>
          )}

          {current.type === 'short' && (
            <textarea value={answers[String(current.id)] || ''}
              onChange={e => setAnswer(current.id, e.target.value)}
              placeholder="Type your answer…" rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          )}
        </div>

        {error && (
          <div className="mx-6 mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Navigation */}
        <div className="px-6 pb-5 flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition">
              ← Back
            </button>
          )}
          {step < total - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
              {submitting ? 'Submitting…' : 'Submit Assessment ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
