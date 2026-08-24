import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../api/axios'

export default function ClassDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profile, setProfile] = useState(null)

  const fetchDetail = useCallback(async () => {
    try {
      const res = await api.get(`/classes/${id}/students`)
      setData(res.data)
    } catch {
      navigate('/teacher/classes')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  async function handleRemove(studentId, studentName) {
    if (!window.confirm(`Remove ${studentName} from this class?`)) return
    setRemoving(studentId)
    try {
      await api.delete(`/classes/${id}/students/${studentId}`)
      setData(prev => ({
        ...prev,
        students: prev.students.filter(s => s.id !== studentId),
        student_count: prev.student_count - 1,
      }))
      if (selectedStudent?.id === studentId) {
        setSelectedStudent(null)
        setProfile(null)
      }
    } catch {
      alert('Could not remove student.')
    } finally {
      setRemoving(null)
    }
  }

  async function openProfile(student) {
    setSelectedStudent(student)
    setProfile(null)
    setProfileLoading(true)
    try {
      const res = await api.get(`/dashboard/teacher/student/${student.id}/class/${id}`)
      setProfile(res.data)
    } catch {
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }

  if (loading) return <div className="text-slate-400 text-sm p-4">Loading…</div>
  if (!data) return null

  const { class: cls, students } = data

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to="/teacher/classes" className="text-xs text-blue-600 hover:underline mb-1 inline-block">
            ← My Classes
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">{cls.name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {cls.subject} ·{' '}
            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{cls.class_id}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 mb-1">Join Code</p>
          <span className="text-xl font-bold text-blue-700 font-mono tracking-widest">{cls.join_code}</span>
        </div>
      </div>

      <div className={`flex gap-5 ${selectedStudent ? 'items-start' : ''}`}>
        {/* Student table */}
        <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${selectedStudent ? 'flex-1' : 'w-full'}`}>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Students</h2>
            <span className="text-xs text-slate-400">{students.length} enrolled</span>
          </div>

          {students.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No students yet. Share <strong className="text-blue-700">{cls.join_code}</strong> with your students.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr
                    key={s.id}
                    className={`border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer ${selectedStudent?.id === s.id ? 'bg-blue-50' : ''}`}
                    onClick={() => openProfile(s)}
                  >
                    <td className="px-5 py-3 font-medium text-slate-800">{s.name}</td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{s.unique_id}</td>
                    <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleRemove(s.id, s.name)}
                        disabled={removing === s.id}
                        className="text-xs text-red-500 hover:text-red-700 transition disabled:opacity-40"
                      >
                        {removing === s.id ? 'Removing…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Student profile panel */}
        {selectedStudent && (
          <div className="w-80 bg-white border border-slate-200 rounded-xl overflow-hidden flex-shrink-0">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">{selectedStudent.name}</h2>
              <button
                onClick={() => { setSelectedStudent(null); setProfile(null) }}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >×</button>
            </div>

            {profileLoading ? (
              <div className="p-6 text-center text-slate-400 text-sm">Loading profile…</div>
            ) : profile ? (
              <div className="p-5 space-y-4">
                {/* Key stats */}
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Avg Score"    value={profile.avg_score ? `${profile.avg_score}%` : '—'} />
                  <MiniStat label="Attendance"   value={profile.attendance_pct ? `${profile.attendance_pct}%` : '—'} />
                  <MiniStat label="Tasks Done"   value={`${profile.tasks_done}/${profile.tasks_total}`} />
                  <MiniStat label="Streak"       value={`🔥 ${profile.streak}d`} />
                </div>

                {/* Subject scores */}
                {Object.keys(profile.subject_scores || {}).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">By Subject</p>
                    {Object.entries(profile.subject_scores).map(([subj, pct]) => (
                      <ScoreBar key={subj} label={subj} pct={pct} />
                    ))}
                  </div>
                )}

                {/* Weak topics */}
                {profile.weak_topics?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Weak Topics</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.weak_topics.map(t => (
                        <span key={t} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent assessments */}
                {profile.recent_assessments?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recent Assessments</p>
                    <div className="space-y-1.5">
                      {profile.recent_assessments.map((a, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-slate-600 truncate max-w-[150px]">{a.title}</span>
                          <span className={`font-semibold ${a.score_pct < 50 ? 'text-red-500' : a.score_pct < 70 ? 'text-amber-500' : 'text-green-600'}`}>
                            {a.score_pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-sm">No data yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-bold text-slate-800 text-sm mt-0.5">{value}</p>
    </div>
  )
}

function ScoreBar({ label, pct }) {
  const color = pct < 50 ? 'bg-red-400' : pct < 70 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-700">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
