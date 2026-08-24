import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

export default function AttendancePage() {
  const [classes, setClasses]               = useState([])
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [attendanceData, setAttendanceData] = useState(null)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingAtt, setLoadingAtt]         = useState(false)
  const [markDate, setMarkDate]             = useState(today())
  const [marks, setMarks]                   = useState({})   // {student_id: "present"|"absent"}
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)

  function today() {
    return new Date().toISOString().split('T')[0]
  }

  useEffect(() => {
    api.get('/classes/mine')
      .then(res => {
        setClasses(res.data)
        if (res.data.length > 0) setSelectedClassId(res.data[0].id)
      })
      .finally(() => setLoadingClasses(false))
  }, [])

  const fetchAttendance = useCallback(async () => {
    if (!selectedClassId) return
    setLoadingAtt(true)
    try {
      const res = await api.get(`/attendance/class/${selectedClassId}`)
      setAttendanceData(res.data)
      // Pre-fill marks with existing records for selected date
      const existing = res.data.by_date?.[markDate] || []
      const preMarks = {}
      existing.forEach(r => { preMarks[r.student_id] = r.status })
      // Default unmarked students to "present"
      res.data.students.forEach(s => {
        if (!(s.student_id in preMarks)) preMarks[s.student_id] = 'present'
      })
      setMarks(preMarks)
    } catch {
      setAttendanceData(null)
    } finally {
      setLoadingAtt(false)
    }
  }, [selectedClassId, markDate])

  useEffect(() => { fetchAttendance() }, [fetchAttendance])

  function toggle(studentId) {
    setMarks(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }))
  }

  async function saveAttendance() {
    setSaving(true)
    setSaved(false)
    try {
      const records = Object.entries(marks).map(([sid, status]) => ({
        student_id: parseInt(sid), status,
      }))
      await api.post('/attendance/bulk', {
        class_id: selectedClassId,
        date: markDate,
        records,
      })
      setSaved(true)
      fetchAttendance()
      setTimeout(() => setSaved(false), 2500)
    } catch {
      alert('Could not save attendance.')
    } finally {
      setSaving(false)
    }
  }

  const selectedClass = classes.find(c => c.id === selectedClassId)
  if (loadingClasses) return <div className="text-slate-400 text-sm p-4">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
          <p className="text-slate-500 text-sm mt-1">Mark and review student attendance</p>
        </div>
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
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">Create a class first.</p>
        </div>
      ) : loadingAtt ? (
        <div className="text-slate-400 text-sm p-4">Loading attendance…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Mark attendance panel */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-semibold text-slate-800">Mark Attendance</h2>
              <div className="flex items-center gap-3">
                <input type="date" value={markDate}
                  onChange={e => setMarkDate(e.target.value)}
                  max={today()}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={saveAttendance} disabled={saving}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${
                    saved ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } disabled:opacity-60`}>
                  {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
                </button>
              </div>
            </div>

            {!attendanceData?.students?.length ? (
              <div className="p-8 text-center text-slate-400 text-sm">No students enrolled.</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {attendanceData.students.map(s => {
                  const status = marks[s.student_id] || 'present'
                  return (
                    <div key={s.student_id}
                      className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{s.student_name}</p>
                        <p className="text-xs text-slate-400 font-mono">{s.unique_id}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{s.attendance_pct}% overall</span>
                        <button onClick={() => toggle(s.student_id)}
                          className={`w-20 py-1.5 text-xs font-semibold rounded-lg border transition ${
                            status === 'present'
                              ? 'bg-green-100 border-green-200 text-green-700'
                              : 'bg-red-100 border-red-200 text-red-600'
                          }`}>
                          {status === 'present' ? '✓ Present' : '✗ Absent'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Summary panel */}
          <div className="space-y-4">
            {/* Quick stats */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-800 mb-3 text-sm">Class Summary</h2>
              <div className="space-y-2">
                {(attendanceData?.students || []).map(s => (
                  <div key={s.student_id}
                    className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 truncate max-w-[120px]">{s.student_name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            s.attendance_pct >= 80 ? 'bg-green-500' : s.attendance_pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${s.attendance_pct}%` }}
                        />
                      </div>
                      <span className={`font-semibold w-10 text-right ${
                        s.attendance_pct >= 80 ? 'text-green-600' : s.attendance_pct >= 60 ? 'text-amber-600' : 'text-red-600'
                      }`}>{s.attendance_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Streaks */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-800 mb-3 text-sm">Learning Streaks</h2>
              <div className="space-y-2">
                {(attendanceData?.students || [])
                  .sort((a, b) => b.streak - a.streak)
                  .map(s => (
                    <div key={s.student_id}
                      className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 truncate max-w-[130px]">{s.student_name}</span>
                      <span className={`font-semibold ${s.streak > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                        🔥 {s.streak}d
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
