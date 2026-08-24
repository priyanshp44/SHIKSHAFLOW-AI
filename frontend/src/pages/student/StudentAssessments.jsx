import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import TakeAssessmentModal from '../../components/TakeAssessmentModal'
import AssessmentResultModal from '../../components/AssessmentResultModal'

export default function StudentAssessments() {
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeAssessment, setActiveAssessment] = useState(null)
  const [resultAssessment, setResultAssessment] = useState(null)
  const [filter, setFilter]           = useState('all')

  const fetchAssessments = useCallback(async () => {
    try {
      const res = await api.get('/assessments/mine')
      setAssessments(res.data)
    } catch { setAssessments([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAssessments() }, [fetchAssessments])

  function handleSubmitted(id, scorePct) {
    setAssessments(prev => prev.map(a =>
      a.id === id ? { ...a, status: 'completed', score_pct: scorePct } : a
    ))
    setActiveAssessment(null)
  }

  const filtered = filter === 'all' ? assessments : assessments.filter(a => a.status === filter)
  const pendingCount = assessments.filter(a => a.status === 'pending').length
  const doneCount    = assessments.filter(a => a.status === 'completed').length

  if (loading) return <div className="text-slate-400 text-sm p-4">Loading assessments…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Assessments</h1>
          <p className="text-slate-500 text-sm mt-1">{pendingCount} pending · {doneCount} completed</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {[
          { key: 'all',       label: `All (${assessments.length})` },
          { key: 'pending',   label: `Pending (${pendingCount})` },
          { key: 'completed', label: `Done (${doneCount})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filter === key ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">
            {filter === 'pending' ? 'No pending assessments.' :
             filter === 'completed' ? 'No completed assessments yet.' :
             'No assessments assigned yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <StudentAssessmentCard
              key={a.id} assessment={a}
              onStart={() => setActiveAssessment(a)}
              onViewResult={() => setResultAssessment(a)}
            />
          ))}
        </div>
      )}

      {activeAssessment && (
        <TakeAssessmentModal
          assessment={activeAssessment}
          onSubmitted={(scorePct) => handleSubmitted(activeAssessment.id, scorePct)}
          onClose={() => setActiveAssessment(null)}
        />
      )}
      {resultAssessment && (
        <AssessmentResultModal
          assessment={resultAssessment}
          onClose={() => setResultAssessment(null)}
        />
      )}
    </div>
  )
}

function StudentAssessmentCard({ assessment, onStart, onViewResult }) {
  const isDone = assessment.status === 'completed'
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold text-slate-800">{assessment.title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isDone ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>{isDone ? 'Completed' : 'Pending'}</span>
        </div>
        <p className="text-xs text-slate-500">
          {assessment.class_name} · {assessment.type} · {assessment.question_count} questions
        </p>
        {isDone && assessment.score_pct != null && (
          <p className={`text-xs mt-1 font-semibold ${
            assessment.score_pct >= 70 ? 'text-green-600' : assessment.score_pct >= 50 ? 'text-amber-600' : 'text-red-600'
          }`}>Score: {assessment.score_pct}%</p>
        )}
      </div>
      <div className="flex-shrink-0">
        {isDone ? (
          <button onClick={onViewResult}
            className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition font-medium">
            View Result
          </button>
        ) : (
          <button onClick={onStart}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition font-medium">
            Start →
          </button>
        )}
      </div>
    </div>
  )
}
