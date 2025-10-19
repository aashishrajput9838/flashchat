import { useEffect, useState } from 'react';
import './App.css';
import { LeftRail } from '@/components/left-rail';
import { ConversationList } from '@/components/conversation-list';
import { ChatThread } from '@/components/chat-thread';
import { RightSidebar } from '@/components/right-sidebar';
import { CallNotification } from '@/components/call-notification';
import { VideoCall } from '@/components/video-call';
import { initAuth, getCurrentUser, subscribeToFriends } from '@/lib/userService';
import { Login } from '@/components/login';
import { X, Phone } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [friends, setFriends] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [activeIncomingVideoCall, setActiveIncomingVideoCall] = useState(null);
  const currentUser = getCurrentUser();

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

  // Subscribe to friends list
  useEffect(() => {
    if (user) {
      const unsubscribe = subscribeToFriends((friendsList) => {
        setFriends(friendsList);
      });
      
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }
  }, [user]);

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
  // Only allow chatting with friends
  const selectChat = (user) => {
    // Check if the selected user is in the friends list
    const isFriend = friends.some(friend => friend.uid === user.uid);
    
    // Allow user to chat with themselves (for testing purposes)
    const isSelf = user.uid === currentUser?.uid;
    
    if (isFriend || isSelf) {
      setSelectedChat(user);
    } else {
      // Close the chat if the user is no longer a friend
      setSelectedChat(null);
      // Optionally show a message or prevent selection
      console.log("Cannot chat with non-friends");
      // You could show a toast or modal here informing the user
    }
  };

  // Function to handle closing the chat
  const handleCloseChat = () => {
    setSelectedChat(null);
  };

  return (
    <main className="min-h-dvh p-3 md:p-4 lg:p-6">
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
          selectedChat={selectedChat}
          role={activeIncomingVideoCall.role}
          callId={activeIncomingVideoCall.callId}
          onClose={() => setActiveIncomingVideoCall(null)}
          onCallEnd={() => setActiveIncomingVideoCall(null)}
        />
      )}

      {/* Legacy incoming call mock overlay */}
      {showIncomingCall && incomingCall && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl h-[80vh] bg-card rounded-xl border flex flex-col">
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
                  className="grid h-12 w-12 place-items-center rounded-full bg-destructive hover:bg-destructive/90"
                  aria-label="Decline call">
                  <Phone className="h-5 w-5 text-white rotate-[135deg]" />
                </button>
                
                <button
                  onClick={() => {
                    alert('Call accepted! Connecting...');
                    setShowIncomingCall(false);
                  }}
                  className="grid h-12 w-12 place-items-center rounded-full bg-green-500 hover:bg-green-600"
                  aria-label="Accept call">
                  <Phone className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
          <ChatThread selectedChat={selectedChat} onClose={handleCloseChat} />
        </section>

        {/* Right sidebar */}
        <aside className="lg:col-span-1">
          <RightSidebar onUserClick={selectChat} />
        </aside>
      </div>
    </main>
  );
}