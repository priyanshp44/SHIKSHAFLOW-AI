import { useState } from 'react'
import api from '../api/axios'

export default function GenerateTaskModal({ classes, onGenerated, onClose }) {
  const [form, setForm] = useState({
    class_id: classes[0]?.id || '',
    subject: classes[0]?.subject || '',
    topic: '',
    difficulty: 'medium',
    num_questions: 5,
    question_types: 'mcq',
    target: 'all',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function update(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-fill subject when class changes
      if (field === 'class_id') {
        const cls = classes.find(c => c.id === parseInt(value))
        if (cls) next.subject = cls.subject
      }
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.topic.trim()) { setError('Topic is required.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/ai/generate-task', {
        ...form,
        class_id: parseInt(form.class_id),
        num_questions: parseInt(form.num_questions),
      })
      onGenerated(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'AI generation failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Generate Task with AI</h2>
            <p className="text-xs text-slate-500 mt-0.5">IBM Granite will create questions — you approve before assigning</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Class */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
            <select value={form.class_id} onChange={e => update('class_id', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name} — {cls.subject}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
            <input type="text" value={form.subject} onChange={e => update('subject', e.target.value)} required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
            <input type="text" value={form.topic} onChange={e => update('topic', e.target.value)} required
              placeholder="e.g. Equivalent Fractions"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Row: difficulty + questions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty</label>
              <select value={form.difficulty} onChange={e => update('difficulty', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Questions</label>
              <input type="number" value={form.num_questions} onChange={e => update('num_questions', e.target.value)}
                min="2" max="15"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Row: type + target */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Question Type</label>
              <select value={form.question_types} onChange={e => update('question_types', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="mcq">MCQ Only</option>
                <option value="truefalse">True / False</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target</label>
              <select value={form.target} onChange={e => update('target', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">Whole Class</option>
                <option value="weak">Weak Students (&lt;60%)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Generating…
                </>
              ) : '✨ Generate with AI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
