import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

/**
 * Teacher Intervention page.
 *
 * Shows at-risk students per class, lets the teacher select a weak topic,
 * calls POST /ai/suggest-remedial to get a suggested remedial task plan,
 * then lets the teacher directly trigger AI task generation (POST /ai/generate-task)
 * followed by review in the existing draft approval flow.
 */
export default function InterventionPage() {
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingData, setLoadingData] = useState(false)

  // Remedial suggestion state
  const [selectedTopic, setSelectedTopic] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [suggestionError, setSuggestionError] = useState('')

  // Task generation state
  const [generating, setGenerating] = useState(false)
  const [genSuccess, setGenSuccess] = useState('')
  const [genError, setGenError] = useState('')

  useEffect(() => {
    api.get('/classes/mine')
      .then(res => {
        setClasses(res.data)
        if (res.data.length > 0) setSelectedClassId(res.data[0].id)
      })
      .finally(() => setLoadingClasses(false))
  }, [])

  const fetchAnalytics = useCallback(async () => {
    if (!selectedClassId) return
    setLoadingData(true)
    setSuggestion(null)
    setSuggestionError('')
    setGenSuccess('')
    setGenError('')
    setSelectedTopic('')
    try {
      const res = await api.get(`/analytics/class/${selectedClassId}`)
      setAnalytics(res.data)
    } catch {
      setAnalytics(null)
    } finally {
      setLoadingData(false)
    }
  }, [selectedClassId])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  async function handleSuggest() {
    if (!selectedTopic || !selectedClassId) return
    setSuggesting(true)
    setSuggestion(null)
    setSuggestionError('')
    setGenSuccess('')
    setGenError('')
    try {
      const res = await api.post('/ai/suggest-remedial', {
        class_id: selectedClassId,
        topic: selectedTopic,
        target: 'weak',
      })
      setSuggestion(res.data)
    } catch (err) {
      setSuggestionError(err.response?.data?.detail || 'Could not get suggestion. Try again.')
    } finally {
      setSuggesting(false)
    }
  }

  async function handleGenerateTask() {
    if (!suggestion || !selectedClassId) return
    setGenerating(true)
    setGenSuccess('')
    setGenError('')
    try {
      await api.post('/ai/generate-task', {
        class_id: selectedClassId,
        subject: classes.find(c => c.id === selectedClassId)?.subject || suggestion.topic,
        topic: selectedTopic,
        difficulty: suggestion.suggested_difficulty || 'easy',
        num_questions: suggestion.suggested_num_questions || 8,
        question_types: suggestion.suggested_types || 'mcq',
        target: 'weak',
      })
      setGenSuccess('Remedial task draft created. Go to Tasks → Drafts to review and approve it.')
    } catch (err) {
      setGenError(err.response?.data?.detail || 'Task generation failed. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  const weakTopics = Object.entries(analytics?.topic_avgs || {})
    .filter(([, avg]) => avg < 60)
    .sort((a, b) => a[1] - b[1])
    .map(([topic]) => topic)

  if (loadingClasses) return <div className="text-slate-400 text-sm p-4">Loading…</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Teacher Intervention</h1>
        <p className="text-slate-500 text-sm mt-1">
          Identify weak topics → get AI remedial suggestions → generate task draft → approve → assign
        </p>
      </div>

      {/* Class selector */}
      {classes.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
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

      {loadingData ? (
        <div className="text-slate-400 text-sm">Loading class data…</div>
      ) : !analytics ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">No assessment data yet. Run some assessments first.</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Step 1 — At-risk overview */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <p className="font-semibold text-slate-800 text-sm">Step 1 — Review At-Risk Students</p>
            </div>
            {analytics.at_risk?.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {analytics.at_risk.map(s => (
                  <div key={s.student_id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-slate-800 text-sm">{s.student_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          s.risk_level === 'high'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {s.risk_level === 'high' ? '🔴 High' : '🟡 Medium'}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
                        <span>Score: <strong>{s.avg_score || 0}%</strong></span>
                        <span>Attendance: <strong>{s.attendance_pct}%</strong></span>
                        <span>Tasks: <strong>{s.task_completion_pct}%</strong></span>
                      </div>
                    </div>
                    {s.reasons?.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {s.reasons.map(r => (
                          <span key={r} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-6 text-center text-sm text-green-600">
                🎉 No students flagged for attention in this class.
              </div>
            )}
          </div>

          {/* Step 2 — Topic selection */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="font-semibold text-slate-800 text-sm mb-3">Step 2 — Select a Weak Topic for Remediation</p>
            {weakTopics.length === 0 ? (
              <p className="text-sm text-slate-400">No weak topics detected yet (need assessment data).</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {weakTopics.map(topic => (
                    <button
                      key={topic}
                      onClick={() => { setSelectedTopic(topic); setSuggestion(null); setGenSuccess(''); setGenError('') }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                        selectedTopic === topic
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-red-50 text-red-700 border-red-200 hover:border-red-400'
                      }`}
                    >
                      {topic} — {analytics.topic_avgs[topic]}%
                    </button>
                  ))}
                </div>
                {/* Also allow typing a custom topic */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Or type a topic name…"
                    value={selectedTopic}
                    onChange={e => { setSelectedTopic(e.target.value); setSuggestion(null) }}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSuggest}
                    disabled={!selectedTopic || suggesting}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {suggesting ? 'Analysing…' : '🤖 Get AI Suggestion'}
                  </button>
                </div>
              </div>
            )}
            {suggestionError && (
              <p className="mt-2 text-sm text-red-600">{suggestionError}</p>
            )}
          </div>

          {/* Step 3 — AI Suggestion */}
          {suggestion && (
            <div className="bg-white border border-blue-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-blue-100 bg-blue-50 flex items-center justify-between">
                <p className="font-semibold text-blue-800 text-sm">Step 3 — AI Remedial Suggestion</p>
                {!suggestion.ai_available && (
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Rule-based (AI offline)
                  </span>
                )}
              </div>
              <div className="p-5 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{suggestion.weak_count}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Weak Students</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-slate-800">{suggestion.total_students}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total Students</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">
                      {suggestion.total_students > 0
                        ? Math.round((suggestion.weak_count / suggestion.total_students) * 100)
                        : 0}%
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">At Risk</p>
                  </div>
                </div>

                {/* Suggested task details */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Suggested Remedial Task</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Title: </span>
                      <span className="font-medium text-slate-800">{suggestion.suggested_title || `${suggestion.topic} — Remedial Practice`}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Difficulty: </span>
                      <span className="font-medium text-slate-800 capitalize">{suggestion.suggested_difficulty || 'easy'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Questions: </span>
                      <span className="font-medium text-slate-800">{suggestion.suggested_num_questions || 8}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Type: </span>
                      <span className="font-medium text-slate-800">{suggestion.suggested_types || 'mcq'}</span>
                    </div>
                  </div>
                  {suggestion.rationale && (
                    <p className="text-xs text-slate-600 pt-1 border-t border-slate-200">
                      <span className="font-medium">Rationale: </span>{suggestion.rationale}
                    </p>
                  )}
                  {suggestion.focus_areas?.length > 0 && (
                    <div className="pt-1 border-t border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Focus areas:</p>
                      <div className="flex flex-wrap gap-1">
                        {suggestion.focus_areas.map(fa => (
                          <span key={fa} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                            {fa}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Weak students preview */}
                {suggestion.weak_students?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Students below 60% in {suggestion.topic}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestion.weak_students.map(s => (
                        <span key={s.name} className="text-xs bg-red-50 text-red-700 border border-red-100 px-3 py-1 rounded-full">
                          {s.name} · {s.score}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 4 — Generate task */}
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-sm font-semibold text-slate-800 mb-2">
                    Step 4 — Generate Task Draft for Review
                  </p>
                  <p className="text-xs text-slate-500 mb-3">
                    This will create an AI-generated draft. You must review and approve it in
                    <strong> Tasks → Drafts</strong> before students can see it.
                  </p>
                  {genSuccess ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                      ✓ {genSuccess}
                    </div>
                  ) : (
                    <>
                      {genError && (
                        <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                          {genError}
                        </div>
                      )}
                      <button
                        onClick={handleGenerateTask}
                        disabled={generating}
                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60"
                      >
                        {generating ? 'Generating…' : '⚡ Generate Remedial Task Draft'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
