import React, { useState, useEffect } from 'react';
import { ThemeContext } from './App';
import { LeftRail } from "@/components/left-rail";
import { ConversationList } from "@/components/conversation-list";
import { ChatThread } from "@/components/chat-thread";
import { RightSidebar } from "@/components/right-sidebar";
import { CallNotification } from "@/components/call-notification";
import { VideoCall } from "@/components/video-call";
import { X } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getCurrentUser, subscribeToFriends } from '@/lib/userService';

export default function App() {
  // Theme state
  const [theme, setTheme] = useState('dark');
  
  // User state
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Chat state
  const [selectedChat, setSelectedChat] = useState(null);
  
  // Mobile UI state
  const [showMobileConversations, setShowMobileConversations] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  
  // Call state
  const [activeIncomingVideoCall, setActiveIncomingVideoCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  
  // Toggle theme
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);
  
  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Handle closing chat on mobile
  const handleCloseChat = () => {
    setSelectedChat(null);
  };
  
  // Select a chat
  const selectChat = (user) => {
    setSelectedChat(user);
    // Close mobile overlays when selecting a chat
    setShowMobileConversations(false);
    setShowMobileSidebar(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading FlashChat...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container flex items-center justify-between h-16 px-4">
            <div className="flex items-center gap-2">
              <div className="bg-primary rounded-full w-8 h-8 flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">FC</span>
              </div>
              <h1 className="text-xl font-bold">FlashChat</h1>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors text-sm"
              aria-label="Toggle theme">
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </header>
        <main className="container max-w-4xl mx-auto p-4">
          <div className="bg-card rounded-xl border shadow-sm p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Welcome to FlashChat</h2>
              <p className="text-muted-foreground mb-6">
                Sign in to start messaging and making calls with your friends.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b">
          <div className="container flex items-center justify-between h-16 px-4">
            <div className="flex items-center gap-2">
              <div className="bg-primary rounded-full w-8 h-8 flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">FC</span>
              </div>
              <h1 className="text-xl font-bold hidden sm:block">FlashChat</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors text-sm"
                aria-label="Toggle theme">
                {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
              </button>
              <div className="text-sm text-muted-foreground hidden sm:block">
                Welcome, {user.displayName || user.email}
              </div>
            </div>
          </div>
        </header>
        
        {/* Call notifications */}
        <CallNotification 
          onAccept={(call) => {
            // Accept incoming video call using callId from notification
            if (call.type === 'video_call' && call.callId) {
              setActiveIncomingVideoCall({ callId: call.callId, role: 'callee', from: call.callerUid, callerName: call.callerName });
              // Use the WebRTC modal, hide legacy overlay
              setIncomingCall(null);
              setShowIncomingCall(false);
            } else {
              setIncomingCall(call);
              setShowIncomingCall(true);
            }
          }}
          onDecline={(call) => {
            console.log('Call declined:', call);
            // In a real implementation, you would send a decline notification back to the caller
            alert(`Call from ${call.callerName} declined.`);
          }}
        />
        
        {/* Incoming video call interface */}
        {activeIncomingVideoCall && (
          <VideoCall
            // For incoming calls, we need to fetch caller data
            role={activeIncomingVideoCall.role}
            callId={activeIncomingVideoCall.callId}
            onClose={() => setActiveIncomingVideoCall(null)}
            onCallEnd={() => setActiveIncomingVideoCall(null)}
          />
        )}

        {/* Legacy incoming call mock overlay (kept behind popups) */}
        {showIncomingCall && incomingCall && (
          <div className="fixed inset-0 z-[8000] bg-black bg-opacity-75 flex items-center justify-center p-4 pointer-events-auto">
            <div className="w-full max-w-md bg-card rounded-2xl border flex flex-col shadow-2xl">
              {/* Call header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-semibold">{incomingCall.callerName}</h3>
                  <p className="text-sm text-muted-foreground">Incoming video call</p>
                </div>
                <button
                  onClick={() => setShowIncomingCall(false)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-destructive hover:bg-destructive/90"
                  aria-label="Close">
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
              
              {/* Call content */}
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="bg-muted rounded-full w-32 h-32 flex items-center justify-center mb-6">
                  <div className="bg-secondary rounded-full w-24 h-24 flex items-center justify-center">
                    <span className="text-2xl font-bold">
                      {incomingCall.callerName?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                </div>
                <h2 className="text-xl font-semibold mb-2">{incomingCall.callerName}</h2>
                <p className="text-muted-foreground">Video call</p>
              </div>
              
              {/* Call controls */}
              <div className="p-4 border-t">
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => {
                      alert('Call declined');
                      setShowIncomingCall(false);
                    }}
                    className="grid h-14 w-14 place-items-center rounded-full bg-destructive hover:bg-destructive/90 transition-transform hover:scale-105"
                    aria-label="Decline call">
                    <Phone className="h-6 w-6 text-white rotate-[135deg]" />
                  </button>
                  
                  <button
                    onClick={() => {
                      alert('Call accepted! Connecting...');
                      setShowIncomingCall(false);
                    }}
                    className="grid h-14 w-14 place-items-center rounded-full bg-green-500 hover:bg-green-600 transition-transform hover:scale-105"
                    aria-label="Accept call">
                    <Phone className="h-6 w-6 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:gap-6 lg:grid-cols-[70px_340px_1fr_340px] px-3 md:px-4 lg:px-6">
          {/* Left rail */}
          <aside className="hidden lg:block lg:col-span-1">
            <LeftRail />
          </aside>

          {/* Conversations list */}
          <aside className="hidden lg:block lg:col-span-1">
            <ConversationList onSelectChat={selectChat} />
          </aside>

          {/* Chat center - always shows the selected chat */}
          <section className="lg:col-span-1">
            <ChatThread selectedChat={selectedChat} onClose={handleCloseChat} />
          </section>

          {/* Right sidebar */}
          <aside className="hidden lg:block lg:col-span-1">
            <RightSidebar onUserClick={selectChat} />
          </aside>
        </div>

        {/* Mobile Conversations Overlay */}
        {showMobileConversations && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60">
            <div className="absolute inset-y-0 left-0 w-full max-w-sm bg-card border-r shadow-xl flex flex-col">
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="text-base font-semibold">Conversations</h3>
                <button
                  onClick={() => setShowMobileConversations(false)}
                  className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary hover:bg-muted"
                  aria-label="Close conversations">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <ConversationList
                  onSelectChat={(u) => {
                    selectChat(u);
                    setShowMobileConversations(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Mobile Sidebar Overlay */}
        {showMobileSidebar && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60">
            <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-card border-l shadow-xl flex flex-col">
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="text-base font-semibold">People</h3>
                <button
                  onClick={() => setShowMobileSidebar(false)}
                  className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary hover:bg-muted"
                  aria-label="Close sidebar">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <RightSidebar
                  onUserClick={(u) => {
                    selectChat(u);
                    setShowMobileSidebar(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  );
}