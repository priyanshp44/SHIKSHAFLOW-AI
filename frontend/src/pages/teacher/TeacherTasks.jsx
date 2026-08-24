import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../api/axios'
import CreateTaskModal from '../../components/CreateTaskModal'
import TaskSummaryModal from '../../components/TaskSummaryModal'
import GenerateTaskModal from '../../components/GenerateTaskModal'
import TaskApprovalModal from '../../components/TaskApprovalModal'

export default function TeacherTasks() {
  const [searchParams] = useSearchParams()
  const preselectedClassId = searchParams.get('class_id') ? parseInt(searchParams.get('class_id')) : null

  const [classes, setClasses]               = useState([])
  const [selectedClassId, setSelectedClassId] = useState(preselectedClassId)
  const [tasks, setTasks]                   = useState([])
  const [drafts, setDrafts]                 = useState([])   // pending AI drafts
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingTasks, setLoadingTasks]     = useState(false)
  const [showCreate, setShowCreate]         = useState(false)
  const [showGenerate, setShowGenerate]     = useState(false)
  const [summaryTask, setSummaryTask]       = useState(null)
  const [approvalDraft, setApprovalDraft]   = useState(null) // draft to approve

  useEffect(() => {
    api.get('/classes/mine')
      .then(res => {
        setClasses(res.data)
        if (!preselectedClassId && res.data.length > 0) setSelectedClassId(res.data[0].id)
      })
      .finally(() => setLoadingClasses(false))
  }, [preselectedClassId])

  const fetchTasks = useCallback(async () => {
    if (!selectedClassId) return
    setLoadingTasks(true)
    try {
      const [tasksRes, draftsRes] = await Promise.all([
        api.get(`/tasks/class/${selectedClassId}`),
        api.get('/tasks/drafts/pending'),
      ])
      setTasks(tasksRes.data)
      setDrafts(draftsRes.data.filter(d => d.class_id === selectedClassId))
    } catch {
      setTasks([])
      setDrafts([])
    } finally {
      setLoadingTasks(false)
    }
  }, [selectedClassId])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  function handleCreated(task) {
    setTasks(prev => [task, ...prev])
    setShowCreate(false)
  }

  function handleGenerated(draft) {
    // After generation open the approval modal immediately
    setShowGenerate(false)
    setApprovalDraft(draft)
    // Also add to drafts list
    setDrafts(prev => [draft, ...prev])
  }

  function handleApproved(approvedTask) {
    // Move from drafts to tasks list
    setDrafts(prev => prev.filter(d => d.task_id !== approvedTask.id))
    setTasks(prev => [approvedTask, ...prev])
    setApprovalDraft(null)
  }

  function handleRejected(taskId) {
    setDrafts(prev => prev.filter(d => d.task_id !== taskId))
    setApprovalDraft(null)
  }

  async function handleDelete(taskId) {
    if (!window.confirm('Delete this task?')) return
    try {
      await api.delete(`/tasks/${taskId}`)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch {
      alert('Could not delete task.')
    }
  }

  const selectedClass = classes.find(c => c.id === selectedClassId)
  if (loadingClasses) return <div className="text-slate-400 text-sm p-4">Loading…</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tasks</h1>
          <p className="text-slate-500 text-sm mt-1">Create and manage assignments for your classes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGenerate(true)}
            disabled={!selectedClassId || classes.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            ✨ Generate with AI
          </button>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!selectedClassId}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            + New Task
          </button>
        </div>
      </div>

      {/* Class tabs */}
      {classes.length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
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
          <p className="text-slate-400 text-sm">Create a class first before adding tasks.</p>
          <Link to="/teacher/classes" className="mt-2 inline-block text-blue-600 hover:underline text-sm font-medium">
            Go to Classes →
          </Link>
        </div>
      ) : loadingTasks ? (
        <div className="text-slate-400 text-sm p-4">Loading tasks…</div>
      ) : (
        <>
          {/* Pending AI drafts */}
          {drafts.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-slate-700">Pending AI Drafts</h2>
                <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                  {drafts.length} awaiting review
                </span>
              </div>
              <div className="space-y-2">
                {drafts.map(draft => (
                  <div key={draft.task_id || draft.id}
                    className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-slate-800 text-sm">{draft.title}</p>
                        <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                          AI Draft
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {draft.subject} · {draft.topic} · {draft.questions?.length ?? draft.marks} questions
                      </p>
                    </div>
                    <button
                      onClick={() => setApprovalDraft({ ...draft, task_id: draft.task_id || draft.id })}
                      className="flex-shrink-0 text-sm bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg transition font-medium"
                    >
                      Review →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved tasks */}
          {tasks.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
              <p className="text-slate-400 text-sm">No approved tasks for {selectedClass?.name} yet.</p>
              <div className="flex justify-center gap-3 mt-3">
                <button onClick={() => setShowGenerate(true)}
                  className="text-purple-600 hover:underline text-sm font-medium">
                  Generate with AI →
                </button>
                <button onClick={() => setShowCreate(true)}
                  className="text-blue-600 hover:underline text-sm font-medium">
                  Create manually →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.filter(t => t.approved).map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onViewSummary={() => setSummaryTask(task)}
                  onDelete={() => handleDelete(task.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreate && selectedClassId && (
        <CreateTaskModal
          classId={selectedClassId}
          className={selectedClass?.name}
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}

      {showGenerate && classes.length > 0 && (
        <GenerateTaskModal
          classes={classes}
          onGenerated={handleGenerated}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {approvalDraft && (
        <TaskApprovalModal
          draft={approvalDraft}
          onApproved={handleApproved}
          onRejected={handleRejected}
          onClose={() => setApprovalDraft(null)}
        />
      )}

      {summaryTask && (
        <TaskSummaryModal
          task={summaryTask}
          onClose={() => setSummaryTask(null)}
        />
      )}
    </div>
  )
}

function TaskCard({ task, onViewSummary, onDelete }) {
  const due      = task.due_date ? new Date(task.due_date) : null
  const isOverdue = due && due < new Date()
  const qs       = task.questions
    ? (() => { try { return JSON.parse(task.questions) } catch { return [] } })()
    : []

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-semibold text-slate-800">{task.title}</h3>
          {task.ai_generated && (
            <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
              AI Generated
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {task.subject} · {task.topic} · {qs.length} question{qs.length !== 1 ? 's' : ''} · {task.marks} marks
        </p>
        {due && (
          <p className={`text-xs mt-1 font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
            Due: {due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {isOverdue && ' (Overdue)'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onViewSummary}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition font-medium">
          Submissions
        </button>
        <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700 transition">
          Delete
        </button>
      </div>
    </div>
  )
}
