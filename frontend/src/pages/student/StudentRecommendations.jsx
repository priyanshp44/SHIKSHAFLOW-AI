import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import api from '../../api/axios'

const TYPE_STYLES = {
  concept:  { label: 'Concept', bg: 'bg-blue-50 border-blue-200 text-blue-700' },
  practice: { label: 'Practice', bg: 'bg-amber-50 border-amber-200 text-amber-700' },
  quiz:     { label: 'Quiz', bg: 'bg-purple-50 border-purple-200 text-purple-700' },
  revision: { label: 'Revision', bg: 'bg-slate-50 border-slate-200 text-slate-700' },
}

export default function StudentRecommendations() {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  // Load enrolled classes
  useEffect(() => {
    api.get('/classes/enrolled')
      .then(res => {
        setClasses(res.data)
        if (res.data.length > 0) setSelectedClassId(res.data[0].id)
      })
      .catch(() => setClasses([]))
      .finally(() => setLoading(false))
  }, [])

  // Load latest saved recommendation from the dashboard endpoint
  const loadRecommendation = useCallback(async () => {
    if (!selectedClassId || !user?.id) return
    try {
      const dash = await api.get('/dashboard/student')
      setRecommendation(dash.data.recommendations?.length > 0 ? dash.data.recommendations : null)
    } catch {
      setRecommendation(null)
    }
  }, [selectedClassId, user?.id])

  useEffect(() => { loadRecommendation() }, [loadRecommendation])

  async function handleGenerate() {
    if (!selectedClassId || !user?.id) return
    setGenerating(true)
    setError('')
    try {
      const res = await api.post('/ai/recommend', {
        student_id: user.id,
        class_id: selectedClassId,
      })
      setRecommendation(res.data.path)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not generate recommendation. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="text-slate-400 text-sm p-4">Loading…</div>

  const selectedClass = classes.find(c => c.id === selectedClassId)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Learning Path</h1>
        <p className="text-slate-500 text-sm mt-1">
          Personalised recommendations based on your performance and weak topics
        </p>
      </div>

      {classes.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">Join a class first to get personalised recommendations.</p>
        </div>
      ) : (
        <>
          {/* Class selector */}
          {classes.length > 1 && (
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedClassId === cls.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                >
                  {cls.name}
                </button>
              ))}
            </div>
          )}

          {/* Class info */}
          {selectedClass && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">{selectedClass.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{selectedClass.subject}</p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60 flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <span className="animate-spin text-base">⟳</span>
                    Generating…
                  </>
                ) : (
                  <>✨ {recommendation ? 'Regenerate' : 'Generate Learning Path'}</>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Recommendation path */}
          {recommendation && Array.isArray(recommendation) && recommendation.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-blue-50 flex items-center gap-2">
                <span className="text-blue-700 font-semibold text-sm">✨ Your Personalised Learning Path</span>
              </div>
              <div className="divide-y divide-slate-50">
                {recommendation.map((step, i) => {
                  const typeKey = (step.type || 'practice').toLowerCase()
                  const style = TYPE_STYLES[typeKey] || TYPE_STYLES.practice
                  return (
                    <div key={i} className="px-5 py-4 flex items-start gap-4">
                      {/* Step number */}
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {step.step ?? i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-slate-800">{step.topic}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${style.bg}`}>
                            {style.label}
                          </span>
                        </div>
                        {step.activity && (
                          <p className="text-sm text-slate-600">{step.activity}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
                <p className="text-xs text-slate-400">
                  Generated by IBM Granite · Based on your topic performance and task history
                </p>
              </div>
            </div>
          ) : !generating && (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
              <p className="text-slate-400 text-sm mb-2">No learning path generated yet.</p>
              <p className="text-slate-400 text-xs">
                Click "Generate Learning Path" to get personalised recommendations from IBM Granite.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
