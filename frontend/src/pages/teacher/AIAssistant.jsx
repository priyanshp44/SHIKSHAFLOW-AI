import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../api/axios'

const SUGGESTED = [
  "Which students are struggling most in this class?",
  "What topics should I focus on next week?",
  "Suggest a remedial activity for weak students.",
  "Why might my class be underperforming in fractions?",
  "Create ideas for an engaging science lesson.",
  "How can I improve student attendance?",
]

export default function AIAssistant() {
  const [classes, setClasses]           = useState([])
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [messages, setMessages]         = useState([])  // {role, content, ts}
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [aiStatus, setAiStatus]         = useState(null) // null | {available, model}
  const [loadingClasses, setLoadingClasses] = useState(true)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // Load classes + AI status in parallel
  useEffect(() => {
    Promise.all([
      api.get('/classes/mine'),
      api.get('/ai/status'),
    ]).then(([classRes, statusRes]) => {
      setClasses(classRes.data)
      if (classRes.data.length > 0) setSelectedClassId(classRes.data[0].id)
      setAiStatus(statusRes.data)
    }).catch(() => {
      setAiStatus({ available: false })
    }).finally(() => setLoadingClasses(false))
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const selectedClass = classes.find(c => c.id === selectedClassId)

  async function sendMessage(text) {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')

    const userMsg = { role: 'user', content: msg, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = messages.slice(-6).map(m => ({
        role: m.role, content: m.content,
      }))
      const res = await api.post('/ai/chat', {
        message: msg,
        class_id: selectedClassId || null,
        history,
      })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        context_used: res.data.class_context_used,
        ts: Date.now(),
      }])
    } catch (err) {
      const detail = err.response?.data?.detail || 'AI service unavailable.'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${detail}`,
        error: true,
        ts: Date.now(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function clearChat() {
    setMessages([])
    setInput('')
  }

  if (loadingClasses) return <div className="text-slate-400 text-sm p-4">Loading…</div>

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">AI Assistant</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Powered by IBM Granite · class-aware teaching support
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat}
            className="text-xs text-slate-400 hover:text-slate-600 transition">
            Clear chat
          </button>
        )}
      </div>

      {/* AI status banner */}
      {aiStatus && !aiStatus.available && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          ⚠️ <strong>AI not configured.</strong> Set{' '}
          <code className="bg-amber-100 px-1 rounded">IBM_API_KEY</code> and{' '}
          <code className="bg-amber-100 px-1 rounded">IBM_PROJECT_ID</code> in{' '}
          <code className="bg-amber-100 px-1 rounded">backend/.env</code> to enable Granite.
        </div>
      )}

      {aiStatus?.available && (
        <div className="mb-4 p-2.5 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 flex items-center justify-between">
          <span>✅ Connected to <strong>{aiStatus.model}</strong></span>
          {selectedClass && (
            <span className="bg-green-100 px-2 py-0.5 rounded-full">
              Context: {selectedClass.name}
            </span>
          )}
        </div>
      )}

      {/* Class selector + model badge */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
            Class context
          </label>
          <select
            value={selectedClassId || ''}
            onChange={e => setSelectedClassId(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No class context</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>
                {cls.name} — {cls.subject}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chat window */}
      <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-xl p-4 space-y-4 mb-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-slate-600 font-medium mb-1">ShikshaFlow AI Assistant</p>
            <p className="text-slate-400 text-sm mb-6">
              {selectedClass
                ? `Ask me anything about ${selectedClass.name}`
                : 'Select a class above for context-aware answers'}
            </p>
            {/* Suggested prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  disabled={!aiStatus?.available}
                  className="text-left text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))
        )}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-sm flex-shrink-0">
              🤖
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || !aiStatus?.available}
            placeholder={
              !aiStatus?.available
                ? 'Configure IBM credentials to enable AI…'
                : selectedClass
                  ? `Ask about ${selectedClass.name}… (Enter to send)`
                  : 'Ask anything… (Enter to send)'
            }
            rows={2}
            className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading || !aiStatus?.available}
          className="h-11 w-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>

      <p className="text-xs text-center text-slate-400 mt-2">
        Enter to send · Shift+Enter for new line · Responses use your class data
      </p>
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
        isUser ? 'bg-blue-100 text-blue-700' : 'bg-purple-100'
      }`}>
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : msg.error
            ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-sm'
            : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-sm'
      }`}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.context_used && !isUser && (
          <p className="text-xs text-slate-400 mt-1.5 border-t border-slate-100 pt-1.5">
            ↳ used class context
          </p>
        )}
      </div>
    </div>
  )
}
