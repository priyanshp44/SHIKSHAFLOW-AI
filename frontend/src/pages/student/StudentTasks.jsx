import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import TakeTaskModal from '../../components/TakeTaskModal'
import TaskResultModal from '../../components/TaskResultModal'

export default function StudentTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState(null)   // task being taken
  const [resultTask, setResultTask] = useState(null)   // task to view result
  const [filter, setFilter] = useState('all')          // 'all' | 'pending' | 'completed'

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get('/tasks/mine')
      setTasks(res.data)
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  function handleSubmitted(updatedTask) {
    setTasks(prev => prev.map(t =>
      t.id === updatedTask.id ? { ...t, status: 'completed', score: updatedTask.score } : t
    ))
    setActiveTask(null)
    setResultTask(updatedTask)
  }

  const filtered = filter === 'all' ? tasks
    : tasks.filter(t => t.status === filter)

  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const doneCount = tasks.filter(t => t.status === 'completed').length

  if (loading) return <div className="text-slate-400 text-sm p-4">Loading tasks…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Tasks</h1>
          <p className="text-slate-500 text-sm mt-1">
            {pendingCount} pending · {doneCount} completed
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { key: 'all',       label: `All (${tasks.length})` },
          { key: 'pending',   label: `Pending (${pendingCount})` },
          { key: 'completed', label: `Done (${doneCount})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">
            {filter === 'pending' ? 'No pending tasks.' : filter === 'completed' ? 'No completed tasks yet.' : 'No tasks assigned yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => (
            <StudentTaskCard
              key={task.id}
              task={task}
              onStart={() => setActiveTask(task)}
              onViewResult={() => setResultTask(task)}
            />
          ))}
        </div>
      )}

      {activeTask && (
        <TakeTaskModal
          task={activeTask}
          onSubmitted={handleSubmitted}
          onClose={() => setActiveTask(null)}
        />
      )}

      {resultTask && (
        <TaskResultModal
          task={resultTask}
          onClose={() => setResultTask(null)}
        />
      )}
    </div>
  )
}

function StudentTaskCard({ task, onStart, onViewResult }) {
  const due = task.due_date ? new Date(task.due_date) : null
  const isOverdue = due && due < new Date() && task.status === 'pending'
  const isDone = task.status === 'completed'

  return (
    <div className={`bg-white border rounded-xl p-5 flex items-center justify-between gap-4 ${
      isDone ? 'border-slate-200' : isOverdue ? 'border-red-200' : 'border-slate-200'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold text-slate-800">{task.title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isDone ? 'bg-green-100 text-green-700' : isOverdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
          }`}>
            {isDone ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {task.class_name} · {task.subject} · {task.topic} · {task.questions?.length ?? 0} questions · {task.marks} marks
        </p>
        {due && (
          <p className={`text-xs mt-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
            Due: {due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
        {isDone && task.score != null && (
          <p className="text-xs mt-1 font-semibold text-slate-600">
            Score: <span className={task.score >= task.marks * 0.7 ? 'text-green-600' : task.score >= task.marks * 0.5 ? 'text-amber-600' : 'text-red-600'}>
              {task.score}/{task.marks}
            </span>
          </p>
        )}
      </div>

      <div className="flex-shrink-0">
        {isDone ? (
          <button
            onClick={onViewResult}
            className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition font-medium"
          >
            View Result
          </button>
        ) : (
          <button
            onClick={onStart}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition font-medium"
          >
            Start →
          </button>
        )}
      </div>
    </div>
  )
}
