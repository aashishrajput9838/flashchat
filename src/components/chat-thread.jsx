import { Paperclip, Mic, Smile, Send, Phone, Video, Ellipsis, LogOut, X, Check, CheckCheck, Clock, MessageCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoCall } from "@/components/video-call"
import { AudioCall } from "@/components/audio-call"
import { useState, useEffect, useRef } from "react"
import { sendMessage, subscribeToMessages } from "@/lib/chatService"
import { getCurrentUser, updateUserProfile, signOutUser, unfriendUser, sendVideoCallNotification } from "@/lib/userService"
import { createCallDocument } from "@/lib/callService"

export function ChatThread({ selectedChat, onClose, showCloseButton = false }) {
  const [message, setMessage] = useState("")
  const [chatMessages, setChatMessages] = useState([])
  const [userName, setUserName] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [showVideoCall, setShowVideoCall] = useState(false)
  const [showAudioCall, setShowAudioCall] = useState(false)
  const [isCalling, setIsCalling] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [activeCallId, setActiveCallId] = useState(null) // Store the active call ID
  const dropdownRef = useRef(null)
  const ellipsisRef = useRef(null)
  const user = getCurrentUser()
  const currentUserId = user ? user.uid : null
  const fileInputRef = useRef(null)
  const messageSubscriptionRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Subscribe to messages when selectedChat changes
  useEffect(() => {
    if (selectedChat && selectedChat.id) {
      // Clean up previous subscription
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current();
      }
      
      // Subscribe to new messages
      messageSubscriptionRef.current = subscribeToMessages(selectedChat.id, (messages) => {
        setChatMessages(messages);
      });
      
      // Set chat title
      setUserName(selectedChat.name || selectedChat.displayName || "Unknown User");
    }
    
    return () => {
      // Clean up subscription on unmount or when chat changes
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current();
        messageSubscriptionRef.current = null;
      }
    };
  }, [selectedChat]);

  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedChat) return;
    
    try {
      await sendMessage(selectedChat.id, message.trim());
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Function to handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      alert(`File selected: ${file.name}
File type: ${file.type}
File size: ${file.size} bytes

In a real application, this file would be uploaded and sent as a message.`);
      // Reset the file input
      e.target.value = '';
    }
  };

  // Function to handle emoji selection
  const handleEmojiSelect = (emoji) => {
    setMessage(prevMessage => prevMessage + emoji);
  };

  // Function to show emoji picker
  const showEmojiPicker = () => {
    const emojis = ['😀', '😂', '😍', '😎', '👍', '👏', '❤️', '🔥', '🎉', '✨'];
    const selectedEmoji = prompt(`Select an emoji:
${emojis.join(' ')}`);
    if (selectedEmoji && emojis.includes(selectedEmoji)) {
      handleEmojiSelect(selectedEmoji);
    }
  };

  // Function to start video call
  const startVideoCall = async () => {
    if (!selectedChat) return;
    
    setIsCalling(true);
    
    try {
      // Create call document in Firestore
      const callId = await createCallDocument(user.uid, selectedChat.uid);
      setActiveCallId(callId); // Store the call ID
      
      // Send video call notification
      await sendVideoCallNotification(selectedChat.uid, user, callId);
      
      // Show video call interface
      setShowVideoCall(true);
    } catch (error) {
      console.error("Error starting video call:", error);
      alert("Failed to start video call. Please try again.");
    } finally {
      setIsCalling(false);
    }
  };

  // Function to start audio call
  const startAudioCall = async () => {
    if (!selectedChat) return;
    
    setIsCalling(true);
    
    try {
      // Create call document in Firestore
      const callId = await createCallDocument(user.uid, selectedChat.uid);
      setActiveCallId(callId); // Store the call ID
      
      // Send audio call notification
      await sendVideoCallNotification(selectedChat.uid, user, callId);
      
      // Show audio call interface
      setShowAudioCall(true);
    } catch (error) {
      console.error("Error starting audio call:", error);
      alert("Failed to start audio call. Please try again.");
    } finally {
      setIsCalling(false);
    }
  };

  // Format message time
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get message status icon
  const getMessageStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <Check className="h-4 w-4 text-muted-foreground" />;
      case 'delivered':
        return <CheckCheck className="h-4 w-4 text-muted-foreground" />;
      case 'read':
        return <CheckCheck className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Handle unfriend action
  const handleUnfriend = async () => {
    if (!selectedChat) return;
    
    try {
      await unfriendUser(selectedChat.uid);
      setShowDropdown(false);
    } catch (error) {
      console.error("Error unfriending user:", error);
      alert("Failed to unfriend user. Please try again.");
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOutUser();
      setShowDropdown(false);
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  // Toggle dropdown menu
  const toggleDropdown = () => {
    setShowDropdown(prev => !prev);
  };

  // Handle attach file
  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  // Get photo URL for messages
  const getMessagePhotoURL = (msg) => {
    if (msg.you) {
      return user?.photoURL;
    }
    return selectedChat?.photoURL;
  };

  // Get chat title
  const chatTitle = selectedChat 
    ? selectedChat.name || selectedChat.displayName || selectedChat.email || "Unknown User"
    : "FlashChat";

  // Get chat avatar
  const chatAvatar = selectedChat 
    ? selectedChat.photoURL || ""
    : "";

  // If no chat is selected, show welcome message
  if (!selectedChat) {
    return (
      <div className="h-full flex flex-col bg-card rounded-xl border shadow-sm">
        {/* Header - hidden when no chat is selected */}
        <div className="hidden lg:flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-secondary rounded-full w-10 h-10 flex items-center justify-center">
              <span className="font-bold">FC</span>
            </div>
            <div>
              <h2 className="font-semibold">FlashChat</h2>
              <p className="text-sm text-muted-foreground">Select a conversation to start chatting</p>
            </div>
          </div>
        </div>
        
        {/* Welcome message */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="bg-secondary rounded-full w-24 h-24 flex items-center justify-center mb-6">
            <MessageCircle className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Welcome to FlashChat</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Select a conversation from the sidebar to start messaging, or add new friends to begin chatting.
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-xs">
            <div className="bg-muted p-4 rounded-lg">
              <Send className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="text-sm font-medium">Messaging</div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <Video className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="text-sm font-medium">Video Calls</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          {showCloseButton && (
            <button
              onClick={onClose}
              className="lg:hidden grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <Avatar className="h-10 w-10">
            <AvatarImage src={chatAvatar} alt={chatTitle} />
            <AvatarFallback className="bg-secondary">
              {chatTitle?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">{chatTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedChat.isOnline ? (
                <span className="flex items-center text-green-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  Online
                </span>
              ) : (
                <span className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Offline
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={startAudioCall}
            disabled={isCalling}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
            aria-label="Audio call"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            onClick={startVideoCall}
            disabled={isCalling}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
            aria-label="Video call"
          >
            <Video className="h-5 w-5" />
          </button>
          <div className="relative">
            <button
              ref={ellipsisRef}
              onClick={toggleDropdown}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="More options"
            >
              <Ellipsis className="h-5 w-5" />
            </button>
            
            {showDropdown && (
              <div 
                ref={dropdownRef}
                className="absolute right-0 top-full mt-2 w-48 bg-card border rounded-lg shadow-lg z-10"
              >
                <button
                  onClick={handleUnfriend}
                  className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Unfriend
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4" />
            <h3 className="text-lg font-medium mb-1">No messages yet</h3>
            <p className="text-sm">Send a message to start the conversation</p>
          </div>
        ) : (
          chatMessages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.you ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-2 max-w-[80%] ${msg.you ? 'flex-row-reverse' : 'flex-row'}`}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getMessagePhotoURL(msg)} alt={msg.name} />
                  <AvatarFallback className="bg-secondary text-xs">
                    {msg.name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className={`rounded-2xl px-4 py-2 ${msg.you ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                  <div className="text-sm">{msg.text}</div>
                  <div className={`text-xs mt-1 flex items-center ${msg.you ? 'text-primary-foreground/70 justify-end' : 'text-muted-foreground justify-start'}`}>
                    <span>{formatMessageTime(msg.timestamp)}</span>
                    {msg.you && (
                      <span className="ml-1">
                        {getMessageStatusIcon(msg.status)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Typing indicator */}
      {isTyping && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={chatAvatar} alt={chatTitle} />
              <AvatarFallback className="bg-secondary text-xs">
                {chatTitle?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-1">
              <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"></div>
              <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Input area */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAttachFile}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            aria-label="File input"
          />
          <button
            type="button"
            onClick={showEmojiPicker}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Add emoji"
          >
            <Smile className="h-5 w-5" />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full px-4 py-2 rounded-full bg-muted border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={!message.trim()}
            className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
      
      {/* Video Call Modal */}
      {showVideoCall && (
        <VideoCall
          selectedChat={selectedChat}
          role="caller"
          callId={activeCallId}
          onClose={() => {
            setShowVideoCall(false);
            setActiveCallId(null);
          }}
          onCallEnd={() => {
            setShowVideoCall(false);
            setActiveCallId(null);
          }}
        />
      )}
      
      {/* Audio Call Modal */}
      {showAudioCall && (
        <AudioCall
          selectedChat={selectedChat}
          role="caller"
          callId={activeCallId}
          onClose={() => {
            setShowAudioCall(false);
            setActiveCallId(null);
          }}
          onCallEnd={() => {
            setShowAudioCall(false);
            setActiveCallId(null);
          }}
        />
      )}
    </div>
  );
}