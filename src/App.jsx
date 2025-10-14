import { useEffect, useState } from 'react';
import './App.css';
import { LeftRail } from '@/components/left-rail';
import { ConversationList } from '@/components/conversation-list';
import { ChatThread } from '@/components/chat-thread';
import { RightSidebar } from '@/components/right-sidebar';
import { initAuth, getCurrentUser } from '@/lib/userService';
import { Login } from '@/components/login';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);

  useEffect(() => {
    // Initialize authentication
    initAuth()
      .then((user) => {
        setUser(user);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Authentication error:', error);
        setLoading(false);
      });
  }, []);

  // Handle login success
  const handleLoginSuccess = (user) => {
    setUser(user);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-lg">Loading FlashChat...</div>
      </div>
    );
  }

  // If user is not authenticated, show login screen
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Function to select a chat (replaces current chat)
  const selectChat = (user) => {
    setSelectedChat(user);
  };

  return (
    <main className="min-h-dvh p-3 md:p-4 lg:p-6">
      {/* Shell */}
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:gap-6 lg:grid-cols-[70px_340px_1fr_340px]">
        {/* Left rail */}
        <aside className="lg:col-span-1">
          <LeftRail />
        </aside>

        {/* Conversations list */}
        <aside className="lg:col-span-1">
          <ConversationList onSelectChat={selectChat} />
        </aside>

        {/* Chat center - always shows the selected chat */}
        <section className="lg:col-span-1">
          <ChatThread selectedChat={selectedChat} />
        </section>

        {/* Right sidebar */}
        <aside className="lg:col-span-1">
          <RightSidebar onUserClick={selectChat} />
        </aside>
      </div>
    </main>
  );
}