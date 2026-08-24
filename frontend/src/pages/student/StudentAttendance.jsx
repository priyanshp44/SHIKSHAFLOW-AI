import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import api from '../../api/axios'

export default function StudentAttendance() {
  const { user } = useAuth()
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/attendance/student/me')
      .then(res => setData(res.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-slate-400 text-sm p-4">Loading attendance…</div>

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">{user?.name} · {user?.unique_id}</p>
      </div>

      {data.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">No attendance records yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map(cls => (
            <div key={cls.class_id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-800">{cls.class_name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{cls.total_days} days tracked</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-xl font-bold ${
                      cls.attendance_pct >= 80 ? 'text-green-600' :
                      cls.attendance_pct >= 60 ? 'text-amber-600' : 'text-red-600'
                    }`}>{cls.attendance_pct}%</p>
                    <p className="text-xs text-slate-400">attendance</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-orange-500">🔥 {cls.streak}d</p>
                    <p className="text-xs text-slate-400">streak</p>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
                {[
                  { label: 'Present', value: cls.present, color: 'text-green-600' },
                  { label: 'Absent',  value: cls.absent,  color: cls.absent > 0 ? 'text-red-600' : 'text-slate-600' },
                  { label: 'Total',   value: cls.total_days, color: 'text-slate-800' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="py-3">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Attendance bar */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      cls.attendance_pct >= 80 ? 'bg-green-500' :
                      cls.attendance_pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${cls.attendance_pct}%` }}
                  />
                </div>
              </div>

              {/* Recent 14-day history */}
              {cls.recent?.length > 0 && (
                <div className="px-5 py-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Recent History
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cls.recent.map(r => (
                      <div key={r.date}
                        title={r.date}
                        className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                          r.status === 'present'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                        }`}>
                        {r.status === 'present' ? '✓' : '✗'}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Last {cls.recent.length} records (newest first)
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
