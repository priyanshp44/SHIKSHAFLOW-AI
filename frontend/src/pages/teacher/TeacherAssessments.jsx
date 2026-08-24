import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import CreateAssessmentModal from '../../components/CreateAssessmentModal'
import AssessmentAnalysisModal from '../../components/AssessmentAnalysisModal'

export default function TeacherAssessments() {
  const [classes, setClasses]               = useState([])
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [assessments, setAssessments]       = useState([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingAssessments, setLoadingAssessments] = useState(false)
  const [showCreate, setShowCreate]         = useState(false)
  const [analysisId, setAnalysisId]         = useState(null)

  useEffect(() => {
    api.get('/classes/mine')
      .then(res => {
        setClasses(res.data)
        if (res.data.length > 0) setSelectedClassId(res.data[0].id)
      })
      .finally(() => setLoadingClasses(false))
  }, [])

  const fetchAssessments = useCallback(async () => {
    if (!selectedClassId) return
    setLoadingAssessments(true)
    try {
      const res = await api.get(`/assessments/class/${selectedClassId}`)
      setAssessments(res.data)
    } catch { setAssessments([]) }
    finally { setLoadingAssessments(false) }
  }, [selectedClassId])

  useEffect(() => { fetchAssessments() }, [fetchAssessments])

  function handleCreated(a) {
    setAssessments(prev => [{ ...a, questions: JSON.parse(a.questions || '[]'), submitted: 0, enrolled: 0, avg_score_pct: null }, ...prev])
    setShowCreate(false)
  }

  const selectedClass = classes.find(c => c.id === selectedClassId)
  if (loadingClasses) return <div className="text-slate-400 text-sm p-4">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Assessments</h1>
          <p className="text-slate-500 text-sm mt-1">Create quizzes and track class performance</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={!selectedClassId}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          + New Assessment
        </button>
      </div>

      {/* Class tabs */}
      {classes.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {classes.map(cls => (
            <button key={cls.id} onClick={() => setSelectedClassId(cls.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedClassId === cls.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
              }`}>
              {cls.name}
            </button>
          ))}
        </div>
      )}

      {classes.length === 0 ? (
        <EmptyState message="Create a class first." link="/teacher/classes" linkText="Go to Classes →" />
      ) : loadingAssessments ? (
        <div className="text-slate-400 text-sm">Loading assessments…</div>
      ) : assessments.length === 0 ? (
        <EmptyState message={`No assessments for ${selectedClass?.name} yet.`} onClick={() => setShowCreate(true)} linkText="Create first assessment →" />
      ) : (
        <div className="space-y-3">
          {assessments.map(a => (
            <AssessmentCard key={a.id} assessment={a} onAnalyse={() => setAnalysisId(a.id)} />
          ))}
        </div>
      )}

      {showCreate && selectedClassId && (
        <CreateAssessmentModal
          classId={selectedClassId}
          className={selectedClass?.name}
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
      {analysisId && (
        <AssessmentAnalysisModal assessmentId={analysisId} onClose={() => setAnalysisId(null)} />
      )}
    </div>
  )
}

function AssessmentCard({ assessment, onAnalyse }) {
  const submittedPct = assessment.enrolled > 0
    ? Math.round(assessment.submitted / assessment.enrolled * 100) : 0

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold text-slate-800">{assessment.title}</h3>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium uppercase">
            {assessment.type}
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-2">
          {assessment.questions?.length ?? 0} questions ·{' '}
          {assessment.submitted}/{assessment.enrolled} submitted ({submittedPct}%)
        </p>
        {assessment.avg_score_pct != null && (
          <div className="flex items-center gap-2">
            <div className="flex-1 max-w-[160px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${assessment.avg_score_pct >= 70 ? 'bg-green-500' : assessment.avg_score_pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${assessment.avg_score_pct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700">
              Class avg: {assessment.avg_score_pct}%
            </span>
          </div>
        )}
      </div>
      <button
        onClick={onAnalyse}
        className="flex-shrink-0 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition font-medium"
      >
        View Analysis
      </button>
    </div>
  )
}

function EmptyState({ message, link, linkText, onClick }) {
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
      <p className="text-slate-400 text-sm">{message}</p>
      {link
        ? <Link to={link} className="mt-2 inline-block text-blue-600 hover:underline text-sm font-medium">{linkText}</Link>
        : <button onClick={onClick} className="mt-2 text-blue-600 hover:underline text-sm font-medium">{linkText}</button>
      }
    </div>
  )
}
