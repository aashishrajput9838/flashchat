import { Paperclip, Mic, Smile, Send, Phone, Video, Ellipsis, LogOut, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect, useRef } from "react"
// Remove socket import
import { sendMessage, subscribeToMessages } from "@/lib/chatService"
import { getCurrentUser, updateUserProfile, signOutUser } from "@/lib/userService"

export function ChatThread({ selectedChat, onClose, showCloseButton = false }) {
  const [message, setMessage] = useState("")
  const [chatMessages, setChatMessages] = useState([])
  const [userName, setUserName] = useState("")
  const messagesEndRef = useRef(null)
  const user = getCurrentUser()

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    // Set user name
    if (user) {
      setUserName(user.displayName || user.email || `User${user.uid.substring(0, 5)}`)
    }

    // If no selected chat, clear messages and return
    if (!selectedChat || !user) {
      setChatMessages([]);
      return () => {};
    }

    // Subscribe to messages from Firestore for the selected user
    const unsubscribe = subscribeToMessages(selectedChat?.uid, (messages) => {
      setChatMessages(messages);
    });

    // Clean up listeners on component unmount
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [user, selectedChat])

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (message.trim() === "" || !selectedChat) return

    // Get current user data to ensure it's up to date
    const currentUser = getCurrentUser();
    
    // Create message object with real user data
    const newMessage = {
      name: currentUser ? (currentUser.displayName || currentUser.email || `User${currentUser.uid.substring(0, 5)}`) : "Anonymous",
      you: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: message,
      userId: currentUser ? currentUser.uid : "anonymous",
      recipientId: selectedChat ? selectedChat.uid : null, // Add recipient ID
      photoURL: currentUser ? currentUser.photoURL : null // Add photoURL
    }

    try {
      // Send message to Firebase with recipient ID
      const messageId = await sendMessage(newMessage, selectedChat?.uid)
      
      // Clear input
      setMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      setMessage("")
    }
  }

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Determine the chat title to display
  const chatTitle = selectedChat 
    ? selectedChat.name 
    : "FlashChat";

  // Determine the chat avatar to display
  const chatAvatar = selectedChat 
    ? (selectedChat.photoURL || (user ? user.photoURL : null) || "/diverse-avatars.png")
    : (user ? user.photoURL : "/images/flashchat-hero.png") || "/diverse-avatars.png";

  // Function to get the correct photoURL for a message
  const getMessagePhotoURL = (message) => {
    // If the message has its own photoURL, use it
    if (message.photoURL) {
      return message.photoURL;
    }
    
    // If it's your message, use your photoURL
    if (message.you && user && user.photoURL) {
      return user.photoURL;
    }
    
    // If it's the selected chat user's message, use their photoURL
    if (!message.you && selectedChat && selectedChat.photoURL) {
      return selectedChat.photoURL;
    }
    
    // Fallback to default avatar
    return "/diverse-avatars.png";
  };

  // If no chat is selected, show a welcome message
  if (!selectedChat) {
    return (
      <div className="flex h-[70vh] min-h-[640px] flex-col items-center justify-center rounded-xl border bg-card lg:h-[calc(100dvh-48px)]">
        <div className="text-center p-8">
          <h3 className="text-xl font-semibold mb-2">Welcome to FlashChat</h3>
          <p className="text-muted-foreground mb-4">Select a friend from the conversation list to start chatting</p>
          <div className="text-sm text-muted-foreground">
            Don't have any friends yet? Use the "Add Friend" button to connect with others!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-[70vh] min-h-[640px] flex-col rounded-xl border bg-card lg:h-[calc(100dvh-48px)]">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b p-3 md:p-4">
        <h3 className="text-base font-semibold">{chatTitle}</h3>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary hover:bg-muted ml-auto"
            aria-label="Close chat">
            <X className="h-4 w-4" />
          </button>
        )}
        {!showCloseButton && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleSignOut}
              className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary hover:bg-muted"
              aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary hover:bg-muted"
              aria-label="Start call">
              <Phone className="h-4 w-4" />
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary hover:bg-muted"
              aria-label="Start video">
              <Video className="h-4 w-4" />
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary hover:bg-muted"
              aria-label="More actions">
              <Ellipsis className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {/* Header media */}
      <div className="p-3 md:p-4">
        <div className="overflow-hidden rounded-xl border">
          <img
            src={chatAvatar}
            alt="Conversation header"
            className="aspect-[16/9] w-full object-cover" />
        </div>
      </div>
      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-3 pb-3 md:px-4">
        {/* Date chip */}
        <div className="flex justify-center">
          <div
            className="rounded-full border bg-secondary px-3 py-1 text-xs text-muted-foreground">Today</div>
        </div>

        {chatMessages.map((m, i) => (
          <div key={m.id || i} className="flex items-start gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage alt={`${m.name} avatar`} src={getMessagePhotoURL(m)} />
              <AvatarFallback>
                {m.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium">{m.you ? userName : m.name}</span>
                <span className="text-xs text-muted-foreground">{m.time}</span>
              </div>
              <p className="text-sm leading-relaxed text-pretty">{m.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {/* Composer */}
      <div className="flex items-center gap-2 border-t p-3 md:p-4">
        <button
          className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary hover:bg-muted"
          aria-label="Attach">
          <Paperclip className="h-4 w-4" />
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary hover:bg-muted"
          aria-label="Voice">
          <Mic className="h-4 w-4" />
        </button>
        <form onSubmit={handleSendMessage} className="relative flex-1">
          <label className="sr-only" htmlFor="message">
            Write a message
          </label>
          <input
            id="message"
            className="w-full rounded-lg border bg-secondary/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:bg-secondary"
            placeholder="Write a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!selectedChat}
          />
        </form>
        <button
          className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary hover:bg-muted"
          aria-label="Emoji">
          <Smile className="h-4 w-4" />
        </button>
        <button
          onClick={handleSendMessage}
          disabled={!selectedChat}
          className="inline-flex items-center gap-2 rounded-lg border bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <Send className="h-4 w-4" />
          <span className="hidden md:inline">Send</span>
        </button>
      </div>
    </div>
  );
}