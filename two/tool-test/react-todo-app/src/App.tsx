import { useState, useEffect } from 'react'
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
    const saved = localStorage.getItem('todos')
    return saved ? JSON.parse(saved) : []
  })
  const [inputValue, setInputValue] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [animatingIds, setAnimatingIds] = useState<number[]>([])

  // 数据持久化
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  // 添加 todo
  const addTodo = () => {
    if (inputValue.trim() === '') return
    
    const newTodo: Todo = {
      id: Date.now(),
      text: inputValue.trim(),
      completed: false,
      createdAt: Date.now()
    }
    
    setAnimatingIds([...animatingIds, newTodo.id])
    setTodos([newTodo, ...todos])
    setInputValue('')
    
    setTimeout(() => {
      setAnimatingIds(animatingIds.filter(id => id !== newTodo.id))
    }, 300)
  }

  // 删除 todo
  const deleteTodo = (id: number) => {
    setAnimatingIds([...animatingIds, id])
    setTimeout(() => {
      setTodos(todos.filter(todo => todo.id !== id))
      setAnimatingIds(animatingIds.filter(i => i !== id))
    }, 300)
  }

  // 切换完成状态
  const toggleComplete = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  // 开始编辑
  const startEdit = (todo: Todo) => {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  // 保存编辑
  const saveEdit = (id: number) => {
    if (editText.trim() === '') {
      deleteTodo(id)
      return
    }
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, text: editText.trim() } : todo
    ))
    setEditingId(null)
    setEditText('')
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  // 清除所有已完成
  const clearCompleted = () => {
    const completedIds = todos.filter(t => t.completed).map(t => t.id)
    setAnimatingIds(completedIds)
    setTimeout(() => {
      setTodos(todos.filter(todo => !todo.completed))
      setAnimatingIds([])
    }, 300)
  }

  // 筛选后的 todos
  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  // 统计信息
  const total = todos.length
  const completed = todos.filter(t => t.completed).length
  const active = total - completed

  return (
    <div className="app-container">
      <div className="todo-card">
        <h1 className="title">📝 待办事项</h1>
        
        {/* 输入区域 */}
        <div className="input-section">
          <input
            type="text"
            className="todo-input"
            placeholder="添加新的待办事项..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          />
          <button className="add-btn" onClick={addTodo}>
            ➕ 添加
          </button>
        </div>

        {/* 统计信息 */}
        <div className="stats">
          <div className="stat-item">
            <span className="stat-number">{total}</span>
            <span className="stat-label">总计</span>
          </div>
          <div className="stat-item">
            <span className="stat-number active-number">{active}</span>
            <span className="stat-label">进行中</span>
          </div>
          <div className="stat-item">
            <span className="stat-number completed-number">{completed}</span>
            <span className="stat-label">已完成</span>
          </div>
        </div>

        {/* 筛选按钮 */}
        <div className="filter-section">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            全部 ({total})
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            进行中 ({active})
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            已完成 ({completed})
          </button>
          {completed > 0 && (
            <button className="clear-btn" onClick={clearCompleted}>
              🗑️ 清除已完成
            </button>
          )}
        </div>

        {/* Todo 列表 */}
        <div className="todo-list">
          {filteredTodos.length === 0 ? (
            <div className="empty-state">
              <p>🎉 {filter === 'all' ? '暂无待办事项' : filter === 'active' ? '没有进行中的任务' : '没有已完成的任务'}</p>
            </div>
          ) : (
            filteredTodos.map(todo => (
              <div
                key={todo.id}
                className={`todo-item ${todo.completed ? 'completed' : ''} ${animatingIds.includes(todo.id) ? 'fade-out' : 'fade-in'}`}
              >
                {editingId === todo.id ? (
                  <div className="edit-section">
                    <input
                      type="text"
                      className="edit-input"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && saveEdit(todo.id)}
                      autoFocus
                    />
                    <button className="save-btn" onClick={() => saveEdit(todo.id)}>✓</button>
                    <button className="cancel-btn" onClick={cancelEdit}>✕</button>
                  </div>
                ) : (
                  <>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleComplete(todo.id)}
                    />
                    <span className="todo-text" onClick={() => toggleComplete(todo.id)}>
                      {todo.text}
                    </span>
                    <button className="edit-btn" onClick={() => startEdit(todo)}>
                      ✏️
                    </button>
                    <button className="delete-btn" onClick={() => deleteTodo(todo.id)}>
                      🗑️
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* 进度条 */}
        {total > 0 && (
          <div className="progress-section">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(completed / total) * 100}%` }}
              />
            </div>
            <p className="progress-text">完成进度: {Math.round((completed / total) * 100)}%</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App