import { useState } from 'react'
import api from '../api/axios'

export default function TaskApprovalModal({ draft, onApproved, onRejected, onClose }) {
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [error, setError]         = useState('')

  const questions = draft.questions || []

  async function handleApprove() {
    setApproving(true)
    setError('')
    try {
      const res = await api.post(`/tasks/${draft.task_id}/approve`)
      onApproved(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not approve task.')
      setApproving(false)
    }
  }

  async function handleReject() {
    if (!window.confirm('Reject and delete this AI-generated draft?')) return
    setRejecting(true)
    setError('')
    try {
      await api.delete(`/tasks/${draft.task_id}/reject`)
      onRejected(draft.task_id)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not reject task.')
      setRejecting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-lg font-bold text-slate-800">{draft.title}</h2>
              <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
                AI Generated
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {draft.subject} · {draft.topic} · {questions.length} questions · {draft.marks} marks
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-4">×</button>
        </div>

        {/* Important notice */}
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          ⚠️ <strong>Review before approving.</strong> Students will only receive this task after you approve it.
          Check that all questions and answers are accurate.
        </div>

        {error && (
          <div className="mx-6 mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Question preview */}
        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-3">
          {questions.map((q, i) => (
            <QuestionPreview key={q.id || i} question={q} index={i} />
          ))}
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex gap-3">
          <button onClick={handleReject} disabled={rejecting || approving}
            className="flex-1 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition disabled:opacity-50">
            {rejecting ? 'Rejecting…' : '✗ Reject Draft'}
          </button>
          <button onClick={handleApprove} disabled={approving || rejecting}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60 flex items-center justify-center gap-2">
            {approving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Approving…
              </>
            ) : '✓ Approve & Assign to Class'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionPreview({ question, index }) {
  const typeLabel = {
    mcq: 'MCQ', truefalse: 'True/False', short: 'Short Answer'
  }[question.type] || question.type

  const typeColor = {
    mcq:       'bg-blue-50 text-blue-700 border-blue-200',
    truefalse: 'bg-green-50 text-green-700 border-green-200',
    short:     'bg-purple-50 text-purple-700 border-purple-200',
  }[question.type] || 'bg-slate-50 text-slate-600 border-slate-200'

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-medium text-slate-800 flex-1">
          <span className="text-slate-400 mr-1.5">Q{index + 1}.</span>
          {question.text}
        </p>
        <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${typeColor}`}>
          {typeLabel}
        </span>
      </div>

      {/* Options for MCQ */}
      {question.type === 'mcq' && question.options?.length > 0 && (
        <div className="mt-2 space-y-1">
          {question.options.map((opt, i) => (
            <div key={i}
              className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-2 ${
                opt === question.answer
                  ? 'bg-green-100 text-green-800 font-semibold border border-green-200'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}>
              <span className="text-slate-400 w-4">{String.fromCharCode(65 + i)}.</span>
              {opt}
              {opt === question.answer && <span className="ml-auto text-green-600">✓ Correct</span>}
            </div>
          ))}
        </div>
      )}

      {/* True/False answer */}
      {question.type === 'truefalse' && (
        <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg inline-block font-semibold">
          ✓ Answer: {question.answer === 'true' ? 'True' : 'False'}
        </p>
      )}

      {/* Short answer model */}
      {question.type === 'short' && question.answer && (
        <p className="mt-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1.5 rounded-lg">
          Model answer: {question.answer}
        </p>
      )}

      {/* Topic tag */}
      {question.topic && (
        <p className="mt-2 text-xs text-slate-400">Topic: {question.topic}</p>
      )}
    </div>
  )
}
