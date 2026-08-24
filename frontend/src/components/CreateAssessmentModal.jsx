import { useState } from 'react'
import api from '../api/axios'

const EMPTY_Q = (id) => ({ id, type: 'mcq', text: '', options: ['', '', '', ''], answer: '', topic: '' })

export default function CreateAssessmentModal({ classId, className, onCreated, onClose }) {
  const [title, setTitle]       = useState('')
  const [type, setType]         = useState('MCQ')
  const [questions, setQuestions] = useState([EMPTY_Q(1)])
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  function addQ() { setQuestions(p => [...p, EMPTY_Q(p.length + 1)]) }
  function removeQ(idx) { setQuestions(p => p.filter((_, i) => i !== idx)) }
  function updateQ(idx, field, val) {
    setQuestions(p => p.map((q, i) => i === idx ? { ...q, [field]: val } : q))
  }
  function updateOpt(qIdx, optIdx, val) {
    setQuestions(p => p.map((q, i) => {
      if (i !== qIdx) return q
      const opts = [...q.options]; opts[optIdx] = val; return { ...q, options: opts }
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const badQ = questions.find(q => !q.text.trim())
    if (badQ) { setError('All questions need text.'); return }

    setLoading(true)
    try {
      const payload = {
        title,
        class_id: classId,
        type,
        questions: JSON.stringify(
          questions.map(q => ({
            id: q.id,
            type: q.type,
            text: q.text,
            topic: q.topic || 'General',
            ...(q.type === 'mcq' ? { options: q.options.filter(o => o.trim()) } : {}),
            answer: q.answer,
          }))
        ),
      }
      const res = await api.post('/assessments', payload)
      onCreated(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create assessment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">New Assessment</h2>
            <p className="text-xs text-slate-500 mt-0.5">For {className}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {error && <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Assessment Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                placeholder="e.g. Fractions Quiz — Week 3"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="MCQ">MCQ Only</option>
                <option value="MIXED">Mixed (MCQ + Short)</option>
              </select>
            </div>
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">Questions ({questions.length})</p>
            </div>
            <div className="space-y-4 max-h-[46vh] overflow-y-auto pr-1">
              {questions.map((q, idx) => (
                <AssessmentQuestionEditor
                  key={q.id} question={q} index={idx}
                  onChange={(f, v) => updateQ(idx, f, v)}
                  onOptionChange={(oi, v) => updateOpt(idx, oi, v)}
                  onRemove={() => removeQ(idx)}
                  canRemove={questions.length > 1}
                />
              ))}
            </div>
            <button type="button" onClick={addQ}
              className="mt-3 w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition">
              + Add Question
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
              {loading ? 'Creating…' : 'Create Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssessmentQuestionEditor({ question, index, onChange, onOptionChange, onRemove, canRemove }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Q{index + 1}</span>
        <div className="flex items-center gap-3">
          <select value={question.type} onChange={e => onChange('type', e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none">
            <option value="mcq">Multiple Choice</option>
            <option value="truefalse">True / False</option>
            <option value="short">Short Answer</option>
          </select>
          {canRemove && (
            <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">Remove</button>
          )}
        </div>
      </div>

      {/* Topic tag */}
      <input type="text" value={question.topic} onChange={e => onChange('topic', e.target.value)}
        placeholder="Topic (e.g. Fractions)"
        className="w-full mb-2 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />

      <textarea value={question.text} onChange={e => onChange('text', e.target.value)} required
        placeholder="Question text…" rows={2}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none mb-3" />

      {question.type === 'mcq' && (
        <div className="space-y-2 mb-3">
          {question.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-5 text-right">{String.fromCharCode(65+i)}.</span>
              <input type="text" value={opt} onChange={e => onOptionChange(i, e.target.value)}
                placeholder={`Option ${String.fromCharCode(65+i)}`}
                className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
            </div>
          ))}
        </div>
      )}

      {question.type === 'truefalse' ? (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Correct Answer</label>
          <select value={question.answer} onChange={e => onChange('answer', e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select…</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      ) : question.type === 'mcq' ? (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Correct Answer</label>
          <select value={question.answer} onChange={e => onChange('answer', e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select correct…</option>
            {question.options.filter(o => o.trim()).map((opt, i) => (
              <option key={i} value={opt}>{String.fromCharCode(65+i)}. {opt}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Model Answer</label>
          <input type="text" value={question.answer} onChange={e => onChange('answer', e.target.value)}
            placeholder="Expected answer…"
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
      )}
    </div>
  )
}
