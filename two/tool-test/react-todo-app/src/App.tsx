import { useState, useEffect, useRef } from 'react'
import './App.css'

interface Todo {
  id: number
  text: string
  completed: boolean
  createdAt: number
}

type FilterType = 'all' | 'active' | 'completed'

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('react-todos')
    return saved ? JSON.parse(saved) : []
  })
  const [inputValue, setInputValue] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [animatingIds, setAnimatingIds] = useState<Set<number>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLInputElement>(null)

  // 持久化到 localStorage
  useEffect(() => {
    localStorage.setItem('react-todos', JSON.stringify(todos))
  }, [todos])

  // 编辑时自动聚焦
  useEffect(() => {
    if (editingId !== null && editRef.current) {
      editRef.current.focus()
    }
  }, [editingId])

  // 添加动画状态管理
  const addAnimatingId = (id: number) => {
    setAnimatingIds(prev => new Set(prev).add(id))
    setTimeout(() => {
      setAnimatingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 400)
  }

  // 添加 Todo
  const addTodo = () => {
    const text = inputValue.trim()
    if (!text) return

    const newTodo: Todo = {
      id: Date.now(),
      text,
      completed: false,
      createdAt: Date.now()
    }

    setTodos(prev => [newTodo, ...prev])
    setInputValue('')
    addAnimatingId(newTodo.id)
    inputRef.current?.focus()
  }

  // 删除 Todo
  const deleteTodo = (id: number) => {
    setTodos(prev => prev.filter(todo => todo.id !== id))
  }

  // 切换完成状态
  const toggleTodo = (id: number) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    )
  }

  // 开始编辑
  const startEdit = (todo: Todo) => {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  // 保存编辑
  const saveEdit = () => {
    if (editingId === null) return
    const text = editText.trim()
    if (!text) {
      deleteTodo(editingId)
    } else {
      setTodos(prev =>
        prev.map(todo =>
          todo.id === editingId ? { ...todo, text } : todo
        )
      )
    }
    setEditingId(null)
    setEditText('')
  }

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTodo()
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit()
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditText('')
    }
  }

  // 清除已完成
  const clearCompleted = () => {
    setTodos(prev => prev.filter(todo => !todo.completed))
  }

  // 筛选
  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  // 统计
  const totalCount = todos.length
  const activeCount = todos.filter(t => !t.completed).length
  const completedCount = todos.filter(t => t.completed).length

  return (
    <div className="app">
      <div className="container">
        {/* 头部 */}
        <header className="header">
          <h1 className="title">
            <span className="title-icon">✨</span>
            Todo List
            <span className="title-icon">✨</span>
          </h1>
          <p className="subtitle">高效管理你的每一天</p>
        </header>

        {/* 输入区域 */}
        <div className="input-section">
          <input
            ref={inputRef}
            type="text"
            className="todo-input"
            placeholder="添加新任务..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="add-btn" onClick={addTodo} disabled={!inputValue.trim()}>
            <span className="btn-icon">+</span>
            添加
          </button>
        </div>

        {/* 统计信息 */}
        <div className="stats">
          <div className="stat-item">
            <span className="stat-number">{totalCount}</span>
            <span className="stat-label">全部</span>
          </div>
          <div className="stat-item active">
            <span className="stat-number">{activeCount}</span>
            <span className="stat-label">进行中</span>
          </div>
          <div className="stat-item completed">
            <span className="stat-number">{completedCount}</span>
            <span className="stat-label">已完成</span>
          </div>
        </div>

        {/* 筛选器 */}
        <div className="filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            📋 全部
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            ⏳ 进行中
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            ✅ 已完成
          </button>
          {completedCount > 0 && (
            <button className="clear-btn" onClick={clearCompleted}>
              🗑️ 清除已完成
            </button>
          )}
        </div>

        {/* Todo 列表 */}
        <div className="todo-list">
          {filteredTodos.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">
                {filter === 'all' ? '📝' : filter === 'active' ? '🎉' : '📭'}
              </span>
              <p className="empty-text">
                {filter === 'all' && '还没有任务，添加一个吧！'}
                {filter === 'active' && '太棒了！所有任务都完成了！'}
                {filter === 'completed' && '还没有完成的任务'}
              </p>
            </div>
          ) : (
            filteredTodos.map(todo => (
              <div
                key={todo.id}
                className={`todo-item ${todo.completed ? 'completed' : ''} ${
                  animatingIds.has(todo.id) ? 'entering' : ''
                }`}
              >
                <div className="todo-content">
                  <button
                    className={`checkbox ${todo.completed ? 'checked' : ''}`}
                    onClick={() => toggleTodo(todo.id)}
                  >
                    {todo.completed && '✓'}
                  </button>

                  {editingId === todo.id ? (
                    <input
                      ref={editRef}
                      type="text"
                      className="edit-input"
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={saveEdit}
                    />
                  ) : (
                    <span
                      className="todo-text"
                      onDoubleClick={() => startEdit(todo)}
                    >
                      {todo.text}
                    </span>
                  )}
                </div>

                <div className="todo-actions">
                  {editingId !== todo.id && (
                    <>
                      <button
                        className="action-btn edit-btn"
                        onClick={() => startEdit(todo)}
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => deleteTodo(todo.id)}
                        title="删除"
                      >
                        ❌
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <footer className="footer">
          <p>💡 双击任务可编辑 | Enter 确认 | Esc 取消</p>
        </footer>
      </div>
    </div>
  )
}

export default App
