import { useState } from 'react'
import api from '../api/axios'

const EMPTY_QUESTION = (id) => ({ id, type: 'mcq', text: '', options: ['', '', '', ''], answer: '' })

export default function CreateTaskModal({ classId, className, onCreated, onClose }) {
  const [form, setForm] = useState({
    title: '',
    subject: '',
    topic: '',
    due_date: '',
    marks: 10,
  })
  const [questions, setQuestions] = useState([EMPTY_QUESTION(1)])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('details') // 'details' | 'questions'

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function addQuestion() {
    setQuestions(prev => [...prev, EMPTY_QUESTION(prev.length + 1)])
  }

  function removeQuestion(idx) {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  function updateQuestion(idx, field, value) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  }

  function updateOption(qIdx, optIdx, value) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const opts = [...q.options]
      opts[optIdx] = value
      return { ...q, options: opts }
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Validate
    if (activeTab === 'details') { setActiveTab('questions'); return }

    const invalidQ = questions.find(q => !q.text.trim())
    if (invalidQ) { setError('All questions must have text.'); return }

    setLoading(true)
    try {
      const payload = {
        ...form,
        class_id: classId,
        marks: parseInt(form.marks),
        due_date: new Date(form.due_date).toISOString(),
        questions: JSON.stringify(
          questions.map(q => ({
            id: q.id,
            type: q.type,
            text: q.text,
            ...(q.type === 'mcq' ? { options: q.options.filter(o => o.trim()) } : {}),
            answer: q.answer,
          }))
        ),
      }
      const res = await api.post('/tasks', payload)
      onCreated(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create task.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Create Task</h2>
            <p className="text-xs text-slate-500 mt-0.5">For {className}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {['details', 'questions'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'details' ? 'Task Details' : `Questions (${questions.length})`}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Details tab */}
          {activeTab === 'details' && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input type="text" value={form.title} onChange={e => updateForm('title', e.target.value)}
                    required placeholder="e.g. Fractions Practice"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input type="text" value={form.subject} onChange={e => updateForm('subject', e.target.value)}
                    required placeholder="e.g. Mathematics"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
                  <input type="text" value={form.topic} onChange={e => updateForm('topic', e.target.value)}
                    required placeholder="e.g. Fractions"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input type="datetime-local" value={form.due_date} onChange={e => updateForm('due_date', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Marks</label>
                  <input type="number" value={form.marks} onChange={e => updateForm('marks', e.target.value)}
                    required min="1" max="100"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={() => setActiveTab('questions')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition">
                  Next: Add Questions →
                </button>
              </div>
            </div>
          )}

          {/* Questions tab */}
          {activeTab === 'questions' && (
            <div className="p-6">
              <div className="space-y-5 max-h-[50vh] overflow-y-auto pr-1">
                {questions.map((q, idx) => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    index={idx}
                    onChange={(field, val) => updateQuestion(idx, field, val)}
                    onOptionChange={(optIdx, val) => updateOption(idx, optIdx, val)}
                    onRemove={() => removeQuestion(idx)}
                    canRemove={questions.length > 1}
                  />
                ))}
              </div>
              <button type="button" onClick={addQuestion}
                className="mt-4 w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition">
                + Add Question
              </button>
              <div className="flex gap-3 mt-5">
                <button type="button" onClick={() => setActiveTab('details')}
                  className="flex-1 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition">
                  ← Back
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
                  {loading ? 'Creating…' : 'Create & Assign Task'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

function QuestionEditor({ question, index, onChange, onOptionChange, onRemove, canRemove }) {
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

      <textarea
        value={question.text}
        onChange={e => onChange('text', e.target.value)}
        required
        placeholder="Enter question text…"
        rows={2}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none mb-3"
      />

      {question.type === 'mcq' && (
        <div className="space-y-2 mb-3">
          {question.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-5 text-right">{String.fromCharCode(65 + i)}.</span>
              <input type="text" value={opt} onChange={e => onOptionChange(i, e.target.value)}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
            </div>
          ))}
        </div>
      )}

      {question.type === 'truefalse' && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">Correct Answer</label>
          <select value={question.answer} onChange={e => onChange('answer', e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select…</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      )}

      {question.type === 'mcq' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Correct Answer</label>
          <select value={question.answer} onChange={e => onChange('answer', e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select correct option…</option>
            {question.options.filter(o => o.trim()).map((opt, i) => (
              <option key={i} value={opt}>{String.fromCharCode(65+i)}. {opt}</option>
            ))}
          </select>
        </div>
      )}

      {question.type === 'short' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Expected Answer (for AI evaluation)</label>
          <input type="text" value={question.answer} onChange={e => onChange('answer', e.target.value)}
            placeholder="Model answer…"
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
      )}
    </div>
  )
}
