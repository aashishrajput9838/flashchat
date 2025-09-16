import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'

function App() {
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [chatSearch, setChatSearch] = useState('')
  const [messageText, setMessageText] = useState('')
  const [selectedChatId, setSelectedChatId] = useState('1')
  const [chats, setChats] = useState([
    { id: '1', name: 'Aparna', lastMessage: 'Hey there!', unread: 1 },
    { id: '2', name: 'Krish', lastMessage: "Let's catch up", unread: 0 },
    { id: '3', name: 'Aditya', lastMessage: 'See you soon', unread: 0 },
  ])
  const [messagesByChat, setMessagesByChat] = useState({
    '1': [
      { id: 'm1', author: 'Aparna', content: 'Hey! How are you?', timestamp: Date.now() - 1000 * 60 * 60 },
      { id: 'm2', author: 'You', content: "I'm good! What's up?", timestamp: Date.now() - 1000 * 60 * 30 },
    ],
    '2': [
      { id: 'm3', author: 'Bob', content: 'Ping', timestamp: Date.now() - 1000 * 60 * 10 },
    ],
    '3': [
      { id: 'm4', author: 'Charlie', content: 'Travel plans?', timestamp: Date.now() - 1000 * 60 * 5 },
    ],
  })

  useEffect(() => {
    const newSocket = io('http://localhost:3001')

    newSocket.on('connect', () => {
      setConnected(true)
    })

    newSocket.on('disconnect', () => {
      setConnected(false)
    })

    // Listen for messages broadcast by server (if backend emits 'message')
    newSocket.on('message', (payload) => {
      const { chatId, content, author = 'Friend', timestamp = Date.now() } = payload || {}
      if (!chatId || !content) return
      setMessagesByChat((prev) => {
        const existing = prev[chatId] || []
        const next = existing.concat({ id: `${chatId}-${timestamp}`, author, content, timestamp })
        return { ...prev, [chatId]: next }
      })
      setChats((prev) => prev.map(c => c.id === chatId ? { ...c, lastMessage: content, unread: c.id === selectedChatId ? c.unread : (c.unread || 0) + 1 } : c))
    })

    setSocket(newSocket)
    return () => newSocket.close()
  }, [selectedChatId])

  const filteredChats = useMemo(() => {
    const q = chatSearch.trim().toLowerCase()
    if (!q) return chats
    return chats.filter(c => c.name.toLowerCase().includes(q))
  }, [chatSearch, chats])

  const currentMessages = messagesByChat[selectedChatId] || []
  const currentChat = chats.find(c => c.id === selectedChatId)

  function handleSelectChat(chatId) {
    setSelectedChatId(chatId)
    setChats((prev) => prev.map(c => c.id === chatId ? { ...c, unread: 0 } : c))
  }

  function handleSendMessage() {
    const text = messageText.trim()
    if (!text) return

    const newMessage = {
      id: `${selectedChatId}-${Date.now()}`,
      author: 'You',
      content: text,
      timestamp: Date.now(),
    }

    setMessagesByChat((prev) => {
      const existing = prev[selectedChatId] || []
      const next = existing.concat(newMessage)
      return { ...prev, [selectedChatId]: next }
    })

    setChats((prev) => prev.map(c => c.id === selectedChatId ? { ...c, lastMessage: text } : c))

    if (socket && connected) {
      // Tell server about the message (backend should broadcast to room / all)
      socket.emit('message', { chatId: selectedChatId, content: text, author: 'You', timestamp: newMessage.timestamp })
    }

    setMessageText('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="chat-app">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="brand">Chat</div>
          <div className={`status ${connected ? 'online' : 'offline'}`}>{connected ? 'Online' : 'Offline'}</div>
        </div>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search or start new chat"
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
          />
        </div>
        <div className="chat-list">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-list-item ${selectedChatId === chat.id ? 'active' : ''}`}
              onClick={() => handleSelectChat(chat.id)}
            >
              <div className="avatar">{chat.name.charAt(0)}</div>
              <div className="chat-meta">
                <div className="chat-top">
                  <span className="chat-name">{chat.name}</span>
                  {chat.unread ? <span className="unread">{chat.unread}</span> : <span />}
                </div>
                <div className="last-message" title={chat.lastMessage}>{chat.lastMessage}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-window">
        <div className="chat-header">
          <div className="header-left">
            <div className="avatar large">{currentChat?.name?.charAt(0)}</div>
            <div className="contact">
              <div className="name">{currentChat?.name || 'Select a chat'}</div>
              <div className="sub">{connected ? 'online' : 'last seen recently'}</div>
            </div>
          </div>
        </div>

        <div className="messages" id="messages">
          {currentMessages.map((m) => (
            <div key={m.id} className={`message-row ${m.author === 'You' ? 'outgoing' : 'incoming'}`}>
              <div className="bubble">
                <div className="content">{m.content}</div>
                <div className="meta">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="composer">
          <textarea
            placeholder="Type a message"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button className="send" onClick={handleSendMessage} disabled={!messageText.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
