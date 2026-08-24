import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import JoinClassModal from '../../components/JoinClassModal'

export default function StudentClasses() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchClasses = useCallback(async () => {
    try {
      const res = await api.get('/classes/enrolled')
      setClasses(res.data)
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClasses() }, [fetchClasses])

  function handleJoined(cls) {
    // Refresh to get full class info
    fetchClasses()
    setShowModal(false)
  }

  if (loading) return <div className="text-slate-400 text-sm p-4">Loading classes…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Classes</h1>
          <p className="text-slate-500 text-sm mt-1">
            {classes.length} enrolled class{classes.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + Join Class
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">You haven't joined any classes yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-blue-600 hover:underline text-sm font-medium"
          >
            Join a class with a code →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(cls => (
            <div
              key={cls.id}
              className="bg-white border border-slate-200 rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-slate-800">{cls.name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{cls.subject}</p>
                </div>
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">
                  {cls.class_id}
                </span>
              </div>

              <div className="space-y-1.5 mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Teacher</span>
                  <span className="font-medium text-slate-700">{cls.teacher_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Teacher ID</span>
                  <span className="font-mono text-slate-500">{cls.teacher_unique_id}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <JoinClassModal
          onJoined={handleJoined}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
