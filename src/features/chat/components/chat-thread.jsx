import { Paperclip, Mic, Smile, Send, Phone, Video, Ellipsis, LogOut, X, Check, CheckCheck, Clock, MessageCircle, XCircle, Download, FileText, Image, Film, Music, Forward, Check as CheckIcon, ImageOff, Heart, Reply, Copy, Pin, Star, MousePointer, Trash2, ChevronDown } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/avatar"
import { OnlineStatus } from "@/shared/components/online-status"
import { VideoCall } from "@/features/call/components/video-call"
import { AudioCall } from "@/features/call/components/audio-call"
import { useState, useEffect, useRef } from "react"
import { useChat } from "@/features/chat/hooks/useChat"
import { getCurrentUser, updateUserProfile, signOutUser, unfriendUser, sendVideoCallNotification, setAppearOffline, subscribeToFriends } from "@/features/user/services/userService"
import { sendMessage, sendFileMessage } from "@/features/chat/services/chatService"
import { EmojiPicker } from "@/features/chat/components/emoji-picker"

function ImageThumbnail({ src, alt }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className="mb-2 flex h-40 w-full items-center justify-center rounded-lg bg-black/5 text-[11px] text-muted-foreground">
        <ImageOff className="mr-1 h-4 w-4" />
        Failed to load image
      </div>
    )
  }

  return (
    <div className="mb-2 relative">
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse rounded-lg bg-black/5" />
      )}
      <img
        src={src}
        alt={alt}
        className={`max-h-64 w-full rounded-lg object-contain bg-black/5 transition-opacity ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  )
}

export function ChatThread({ selectedChat, onClose, showCloseButton = false }) {
  const { 
    messages: chatMessages, 
    message, 
    setMessage, 
    handleSendMessage, 
    handleSendFileMessage,
    formatMessageTime, 
    messagesEndRef,
    isUploading,
    handleAddReaction,
    handleRemoveReaction
  } = useChat(selectedChat);
  
  const [userName, setUserName] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [showMessageDropdown, setShowMessageDropdown] = useState({}) // For individual message dropdowns
  const [showVideoCall, setShowVideoCall] = useState(false)
  const [showAudioCall, setShowAudioCall] = useState(false)
  const [isCalling, setIsCalling] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [activeCallId, setActiveCallId] = useState(null) // Store the active call ID
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showForwardModal, setShowForwardModal] = useState(false)
  const [friends, setFriends] = useState([])
  const [selectedForwardUserIds, setSelectedForwardUserIds] = useState(new Set())
  const [forwardMessage, setForwardMessage] = useState(null)
  const [showReactionPopup, setShowReactionPopup] = useState({}) // For reaction popups
  const [reactionPopupPosition, setReactionPopupPosition] = useState({}) // Position for reaction popups
  const dropdownRef = useRef(null)
  const ellipsisRef = useRef(null)
  const messageDropdownRefs = useRef({}) // Refs for message dropdowns
  const user = getCurrentUser()
  const currentUserId = user ? user.uid : null
  const fileInputRef = useRef(null)

  // Set chat title when selectedChat changes
  useEffect(() => {
    if (selectedChat) {
      setUserName(selectedChat.name || selectedChat.displayName || "Unknown User");
    }
  }, [selectedChat]);

  // Function to handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleSendFileMessage(file);
      // Reset the file input
      e.target.value = '';
    }
  };

  // Function to handle emoji selection
  const handleEmojiSelect = (emoji) => {
    setMessage(prevMessage => prevMessage + emoji);
  };

  // Function to toggle emoji picker
  const toggleEmojiPicker = () => {
    setShowEmojiPicker(prev => !prev);
  };

  // Function to handle attach file
  const handleAttachFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Function to start video call
  const startVideoCall = async () => {
    if (!selectedChat) return;
    
    // Prevent users from calling themselves
    if (selectedChat.uid === user?.uid) {
      alert("You cannot make a video call to yourself.");
      return;
    }
    
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
    
    // Prevent users from calling themselves
    if (selectedChat.uid === user?.uid) {
      alert("You cannot make an audio call to yourself.");
      return;
    }
    
    setIsCalling(true);
    
    try {
      // Create call document in Firestore
      const callId = await createCallDocument(user.uid, selectedChat.uid);
      setActiveCallId(callId); // Store the call ID
      
      // Send audio call notification
      await sendVideoCallNotification(selectedChat.uid, user, callId, 'audio_call');
      
      // Show audio call interface
      setShowAudioCall(true);
    } catch (error) {
      console.error("Error starting audio call:", error);
      alert("Failed to start audio call. Please try again.");
    } finally {
      setIsCalling(false);
    }
  };

  // Get appropriate icon for file type
  const getFileIcon = (fileType) => {
    if (fileType && fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (fileType && fileType.startsWith('video/')) {
      return <Film className="h-4 w-4" />;
    } else if (fileType && fileType.startsWith('audio/')) {
      return <Music className="h-4 w-4" />;
    } else {
      return <FileText className="h-4 w-4" />;
    }
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
      setShowDropdown(false);
    }
  };

  // Toggle appear offline mode
  const toggleAppearOffline = async () => {
    try {
      const currentUser = getCurrentUser();
      const newAppearOfflineStatus = !currentUser?.appearOffline;
      await setAppearOffline(newAppearOfflineStatus);
      setShowDropdown(false);
      // Instead of reloading the page, just update the user state
      // window.location.reload();
    } catch (error) {
      console.error("Error toggling appear offline:", error);
      alert("Failed to update appear offline status. Please try again.");
      setShowDropdown(false);
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
      setShowDropdown(false);
    }
  };

  // Function to calculate dropdown position
  const calculateDropdownPosition = (buttonRef) => {
    if (!buttonRef.current) return { top: '100%', marginTop: '0.5rem' };
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    const dropdownHeight = 200; // Approximate height of dropdown
    
    // If not enough space below, show above the button
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      return { bottom: '100%', marginBottom: '0.5rem' };
    }
    
    return { top: '100%', marginTop: '0.5rem' };
  };

  // Function to calculate reaction popup position
  const calculateReactionPopupPosition = (buttonRef) => {
    if (!buttonRef.current) return { top: '100%', marginTop: '0.5rem' };
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const spaceRight = viewportWidth - buttonRect.right;
    const spaceLeft = buttonRect.left;
    const popupWidth = 200; // Approximate width of popup
    
    // Center the popup below the button
    if (spaceLeft + buttonRect.width / 2 >= popupWidth / 2 && 
        spaceRight + buttonRect.width / 2 >= popupWidth / 2) {
      return { 
        top: '100%', 
        marginTop: '0.25rem',
        left: '50%',
        transform: 'translateX(-50%)'
      };
    }
    
    // Adjust position if popup would go off screen
    if (spaceLeft < popupWidth / 2) {
      return { 
        top: '100%', 
        marginTop: '0.25rem',
        left: '0'
      };
    }
    
    if (spaceRight < popupWidth / 2) {
      return { 
        top: '100%', 
        marginTop: '0.25rem',
        right: '0'
      };
    }
    
    return { top: '100%', marginTop: '0.25rem' };
  };

  // Toggle reaction popup with position calculation
  const toggleReactionPopup = (messageId) => {
    const isOpening = !showReactionPopup[messageId];
    
    if (isOpening) {
      // Will show popup, calculate position
      setTimeout(() => {
        const buttonRef = { current: messageDropdownRefs.current[messageId] };
        if (buttonRef.current) {
          const position = calculateReactionPopupPosition(buttonRef);
          setReactionPopupPosition(prev => ({
            ...prev,
            [messageId]: position
          }));
        }
      }, 0);
    }
    
    setShowReactionPopup(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  // Toggle dropdown menu with position calculation
  const toggleDropdown = () => {
    if (!showDropdown) {
      // Will show dropdown, calculate position
      setTimeout(() => {
        if (ellipsisRef.current && dropdownRef.current) {
          const position = calculateDropdownPosition(ellipsisRef);
          dropdownRef.current.style.position = 'absolute';
          dropdownRef.current.style.right = '0';
          dropdownRef.current.style.left = 'auto';
          dropdownRef.current.style.maxHeight = '90vh';
          dropdownRef.current.style.overflowY = 'auto';
          
          if (position.top) {
            dropdownRef.current.style.top = position.top;
            dropdownRef.current.style.marginTop = position.marginTop;
            dropdownRef.current.style.bottom = 'auto';
            dropdownRef.current.style.marginBottom = '0';
          } else {
            dropdownRef.current.style.bottom = position.bottom;
            dropdownRef.current.style.marginBottom = position.marginBottom;
            dropdownRef.current.style.top = 'auto';
            dropdownRef.current.style.marginTop = '0';
          }
          
          // Ensure dropdown stays within viewport
          const dropdownRect = dropdownRef.current.getBoundingClientRect();
          if (dropdownRect.right > window.innerWidth) {
            dropdownRef.current.style.right = 'auto';
            dropdownRef.current.style.left = '0';
          }
          
          // Ensure dropdown doesn't go off the bottom of the screen
          const finalDropdownRect = dropdownRef.current.getBoundingClientRect();
          if (finalDropdownRect.bottom > window.innerHeight) {
            dropdownRef.current.style.maxHeight = `${window.innerHeight - finalDropdownRect.top - 10}px`;
            dropdownRef.current.style.overflowY = 'auto';
          }
        }
      }, 0);
    }
    setShowDropdown(prev => !prev);
  };

  // Close reaction popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(showReactionPopup).forEach((messageId) => {
        // Check if click was outside any reaction popup
        const popupElement = document.getElementById(`reaction-popup-${messageId}`);
        const reactButton = messageDropdownRefs.current[messageId]?.querySelector('button');
        
        if (popupElement && !popupElement.contains(event.target) && 
            reactButton && !reactButton.contains(event.target)) {
          setShowReactionPopup(prev => ({ ...prev, [messageId]: false }));
        }
      });
    };

    // Add event listener if any reaction popup is open
    if (Object.values(showReactionPopup).some(visible => visible)) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReactionPopup]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          ellipsisRef.current && !ellipsisRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Close message dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(messageDropdownRefs.current).forEach((messageId) => {
        const ref = messageDropdownRefs.current[messageId];
        if (ref && !ref.contains(event.target)) {
          setShowMessageDropdown(prev => ({ ...prev, [messageId]: false }));
        }
      });
    };

    // Add event listener if any message dropdown is open
    if (Object.values(showMessageDropdown).some(visible => visible)) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMessageDropdown]);

  // Subscribe to friends list for forwarding messages
  useEffect(() => {
    const unsubscribe = subscribeToFriends((friendsList) => {
      const list = (Array.isArray(friendsList) ? friendsList : []).map(friend => ({
        uid: friend.uid,
        name: friend.name || friend.displayName || friend.email || `User${friend.uid.substring(0, 5)}`,
        photoURL: friend.photoURL || "/diverse-avatars.png"
      }))
      setFriends(list)
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  const toggleSelectForwardUser = (uid) => {
    setSelectedForwardUserIds(prev => {
      const next = new Set(prev)
      if (next.has(uid)) {
        next.delete(uid)
      } else {
        next.add(uid)
      }
      return next
    })
  }

  // Toggle message dropdown menu with position calculation
  const toggleMessageDropdown = (messageId) => {
    const isOpening = !showMessageDropdown[messageId];
    setShowMessageDropdown(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
    
    if (isOpening) {
      // Will show dropdown, calculate position
      setTimeout(() => {
        const buttonRef = { current: messageDropdownRefs.current[messageId] };
        const dropdownRef = document.getElementById(`message-dropdown-${messageId}`);
        if (buttonRef.current && dropdownRef) {
          const buttonRect = buttonRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const spaceBelow = viewportHeight - buttonRect.bottom;
          const spaceAbove = buttonRect.top;
          const dropdownHeight = 250; // Approximate height of message dropdown
          
          // Reset styles
          dropdownRef.style.position = 'absolute';
          dropdownRef.style.right = '0';
          dropdownRef.style.left = 'auto';
          dropdownRef.style.maxHeight = '90vh';
          dropdownRef.style.overflowY = 'auto';
          
          // If not enough space below, show above the button
          if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
            dropdownRef.style.bottom = '100%';
            dropdownRef.style.marginBottom = '0.25rem';
            dropdownRef.style.top = 'auto';
            dropdownRef.style.marginTop = '0';
          } else {
            dropdownRef.style.top = '100%';
            dropdownRef.style.marginTop = '0.25rem';
            dropdownRef.style.bottom = 'auto';
            dropdownRef.style.marginBottom = '0';
          }
          
          // Ensure dropdown stays within viewport
          const dropdownRect = dropdownRef.getBoundingClientRect();
          if (dropdownRect.right > window.innerWidth) {
            dropdownRef.style.right = 'auto';
            dropdownRef.style.left = '0';
          }
          
          // Ensure dropdown doesn't go off the bottom of the screen
          const finalDropdownRect = dropdownRef.getBoundingClientRect();
          if (finalDropdownRect.bottom > window.innerHeight) {
            dropdownRef.style.maxHeight = `${window.innerHeight - finalDropdownRect.top - 10}px`;
            dropdownRef.style.overflowY = 'auto';
          }
        }
      }, 0);
    }
  };

  const openForwardModal = (msg) => {
    setForwardMessage(msg)
    setShowForwardModal(true)
    setSelectedForwardUserIds(new Set())
  }

  const handleForwardToSelected = async () => {
    if (!forwardMessage || selectedForwardUserIds.size === 0) return

    // Check if the message is a file message
    const isFileMessage = forwardMessage.fileUrl && forwardMessage.fileName;
    
    let messageData;
    if (isFileMessage) {
      // Forward as file message
      messageData = {
        text: forwardMessage.text || `📎 File: ${forwardMessage.fileName}`,
        name: user?.displayName || 'Anonymous',
        photoURL: user?.photoURL || null,
        you: true,
        fileType: forwardMessage.fileType || 'file',
        fileUrl: forwardMessage.fileUrl,
        fileName: forwardMessage.fileName,
        thumbnailUrl: forwardMessage.thumbnailUrl || null
      };
      
      // Use sendFileMessage for file messages
      try {
        await Promise.all(
          Array.from(selectedForwardUserIds).map(uid => sendFileMessage(messageData, uid))
        )
      } catch (error) {
        console.error('Error forwarding file message:', error)
        throw error;
      }
    } else {
      // Forward as regular text message
      messageData = {
        text: forwardMessage.text || (forwardMessage.fileName ? `${forwardMessage.fileName}` : ''),
        name: user?.displayName || 'Anonymous',
        photoURL: user?.photoURL || null,
        you: true
      };
      
      // Use sendMessage for text messages
      try {
        await Promise.all(
          Array.from(selectedForwardUserIds).map(uid => sendMessage(messageData, uid))
        )
      } catch (error) {
        console.error('Error forwarding text message:', error)
        throw error;
      }
    }

    setShowForwardModal(false)
    setForwardMessage(null)
    setSelectedForwardUserIds(new Set())
  }

  // Close chat on mobile
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  // If no chat is selected, show a placeholder
  if (!selectedChat) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 bg-card rounded-xl border shadow-sm mobile-chat-thread">
        <div className="text-center max-w-xs">
          <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-responsive-xl font-semibold mb-2">FlashChat</h3>
          <p className="text-muted-foreground mb-6 text-responsive-sm">
            Select a conversation to start chatting
          </p>
        </div>
      </div>
    );
  }

  // Get chat title
  const chatTitle = selectedChat 
    ? selectedChat.uid === user?.uid 
      ? "Me" 
      : selectedChat.name || selectedChat.displayName || selectedChat.email || "Unknown User"
    : "FlashChat";

  return (
    <div className="h-[90vh] flex flex-col bg-card rounded-xl border shadow-sm mobile-chat-thread">
      {/* Chat header */}
      <div className="flex items-center justify-between p-3 sm:p-4 md:p-5 border-b flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          {showCloseButton && (
            <button
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-muted transition-colors lg:hidden"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          <div className="relative">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
              <AvatarImage src={selectedChat.photoURL || "/diverse-avatars.png"} alt={chatTitle} />
              <AvatarFallback className="bg-secondary text-responsive-xs">
                {chatTitle?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <h3 className="font-semibold text-responsive-sm sm:font-semibold sm:text-responsive-base">{chatTitle}</h3>
            <div className="flex items-center text-muted-foreground text-responsive-xs">
              <OnlineStatus isOnline={selectedChat.isOnline} lastSeen={selectedChat.lastSeen} showText={true} size="sm" user={selectedChat} />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={startAudioCall}
            disabled={isCalling}
            className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Audio call"
          >
            <Phone className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <button
            onClick={startVideoCall}
            disabled={isCalling}
            className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Video call"
          >
            <Video className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <div className="relative" ref={ellipsisRef}>
            <button
              onClick={toggleDropdown}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Chat options"
            >
              <Ellipsis className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            
            {/* Dropdown menu */}
            {showDropdown && (
              <div 
                ref={dropdownRef}
                className="absolute right-0 w-48 bg-card border rounded-lg shadow-lg z-50 dropdown-constraint"
              >
                <button
                  onClick={() => {
                    handleUnfriend();
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-foreground"
                >
                  <XCircle className="h-4 w-4" />
                  <span className="text-responsive-sm">Unfriend</span>
                </button>
                <button
                  onClick={() => {
                    toggleAppearOffline();
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-foreground"
                >
                  <span className="text-responsive-sm">
                    {user?.appearOffline ? "Appear Online" : "Appear Offline"}
                  </span>
                </button>
                <button
                  onClick={() => {
                    handleSignOut();
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-responsive-sm">Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Messages area - Fixed height with scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 max-h-[calc(90vh-180px)]">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-responsive-xl font-semibold mb-2">No messages yet</h3>
            <p className="text-muted-foreground text-responsive-sm">
              Start a conversation with {chatTitle}
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

            const fileHref = msg.fileUrl
              ? (msg.fileUrl.startsWith('http')
                  ? msg.fileUrl
                  : `${backendUrl}${msg.fileUrl}`)
              : null;

            // For download, use the dedicated download endpoint
            const downloadHref = msg.fileUrl
              ? (msg.fileUrl.startsWith('http')
                  ? msg.fileUrl.replace('/uploads/', '/api/download-file/')
                  : `${backendUrl}/api/download-file/${msg.fileUrl.split('/').pop()}`)
              : null;

            const thumbnailHref = msg.thumbnailUrl
              ? (msg.thumbnailUrl.startsWith('http')
                  ? msg.thumbnailUrl
                  : `${backendUrl}${msg.thumbnailUrl}`)
              : fileHref;

            const isImage = msg.fileType && msg.fileType.startsWith('image/');

            return (
              <div 
                key={msg.id} 
                className={`flex ${msg.userId === currentUserId ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl rounded-2xl px-4 py-2 ${
                    msg.userId === currentUserId 
                      ? 'bg-primary text-primary-foreground rounded-br-none' 
                      : 'bg-muted rounded-bl-none'
                  }`}
                >
                  {/* File message (with thumbnail for images) */}
                  {msg.fileUrl ? (
                    <div>
                      {isImage && thumbnailHref && (
                        <ImageThumbnail
                          src={thumbnailHref}
                          alt={msg.fileName || 'Image'}
                        />
                      )}
                      <div className="flex items-center gap-2">
                        {getFileIcon(msg.fileType)}
                        <div className="flex-1 min-w-0">
                          <p className="text-responsive-sm truncate">{msg.fileName}</p>
                          <a 
                            href={downloadHref} 
                            download={msg.fileName}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-responsive-xs flex items-center gap-1 mt-1 hover:underline"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-responsive-sm">{msg.text}</p>
                  )}
                  
                  {/* Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(msg.reactions).map(([emoji, users]) => {
                        const userCount = Object.keys(users).length;
                        return (
                          <div 
                            key={emoji}
                            className="inline-flex items-center bg-muted rounded-full px-2 py-1 text-xs"
                          >
                            <span>{emoji}</span>
                            {userCount > 1 && (
                              <span className="ml-1">{userCount}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Dropdown button in top right corner */}
                  <div className="relative float-right -mt-1 -mr-1">
                    <button
                      ref={el => messageDropdownRefs.current[msg.id] = el}
                      onClick={() => toggleMessageDropdown(msg.id)}
                      className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      aria-label="Message options"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    
                    {/* Message dropdown menu */}
                    {showMessageDropdown[msg.id] && (
                      <div 
                        id={`message-dropdown-${msg.id}`}
                        className="absolute right-0 w-48 bg-card border rounded-lg shadow-lg z-50 dropdown-constraint"
                      >
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-foreground"
                          onClick={() => {
                            setShowMessageDropdown(prev => ({ ...prev, [msg.id]: false }));
                            toggleReactionPopup(msg.id);
                          }}
                        >
                          <Heart className="h-4 w-4" />
                          <span className="text-responsive-sm">React</span>
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-foreground"
                          onClick={() => {
                            // TODO: Implement reply
                            setShowMessageDropdown(prev => ({ ...prev, [msg.id]: false }));
                          }}
                        >
                          <Reply className="h-4 w-4" />
                          <span className="text-responsive-sm">Reply</span>
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-foreground"
                          onClick={() => {
                            // TODO: Implement copy
                            setShowMessageDropdown(prev => ({ ...prev, [msg.id]: false }));
                          }}
                        >
                          <Copy className="h-4 w-4" />
                          <span className="text-responsive-sm">Copy</span>
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-foreground"
                          onClick={() => {
                            openForwardModal(msg);
                            setShowMessageDropdown(prev => ({ ...prev, [msg.id]: false }));
                          }}
                        >
                          <Forward className="h-4 w-4" />
                          <span className="text-responsive-sm">Forward</span>
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-foreground"
                          onClick={() => {
                            // TODO: Implement pin
                            setShowMessageDropdown(prev => ({ ...prev, [msg.id]: false }));
                          }}
                        >
                          <Pin className="h-4 w-4" />
                          <span className="text-responsive-sm">Pin</span>
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-foreground"
                          onClick={() => {
                            // TODO: Implement star
                            setShowMessageDropdown(prev => ({ ...prev, [msg.id]: false }));
                          }}
                        >
                          <Star className="h-4 w-4" />
                          <span className="text-responsive-sm">Star</span>
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-foreground"
                          onClick={() => {
                            // TODO: Implement select
                            setShowMessageDropdown(prev => ({ ...prev, [msg.id]: false }));
                          }}
                        >
                          <MousePointer className="h-4 w-4" />
                          <span className="text-responsive-sm">Select</span>
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 text-destructive"
                          onClick={() => {
                            // TODO: Implement delete
                            setShowMessageDropdown(prev => ({ ...prev, [msg.id]: false }));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="text-responsive-sm">Delete</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Reaction popup */}
                    {showReactionPopup[msg.id] && (
                      <div 
                        id={`reaction-popup-${msg.id}`}
                        className="absolute bg-card border rounded-full shadow-lg z-50 flex items-center p-1 gap-1"
                        style={reactionPopupPosition[msg.id] || {}}
                      >
                        {['👍', '❤️', '😂', '😮', '😢'].map((emoji) => (
                          <button
                            key={emoji}
                            className="text-lg p-1 hover:bg-muted rounded-full transition-colors"
                            onClick={async () => {
                              await handleAddReaction(msg.id, emoji);
                              setShowReactionPopup(prev => ({ ...prev, [msg.id]: false }));
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className={`flex items-center justify-between mt-1 ${
                    msg.userId === currentUserId ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}>
                    {/* Forward message icon on the left side of the message */}
                    <button
                      type="button"
                      onClick={() => openForwardModal(msg)}
                      className="flex items-center justify-center p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      aria-label="Forward message"
                    >
                      <Forward className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-responsive-xs">{formatMessageTime(msg.timestamp)}</span>
                      {msg.userId === currentUserId && getMessageStatusIcon(msg.status || 'sent')}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Typing indicator */}
      {isTyping && (
        <div className="px-4 py-2 flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={selectedChat.photoURL || "/diverse-avatars.png"} alt={chatTitle} />
            <AvatarFallback className="bg-secondary text-responsive-xs">
              {chatTitle?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex gap-1">
            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"></div>
            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
          </div>
        </div>
      )}
      
      {/* Input area */}
      <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t flex-shrink-0 relative">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAttachFile}
            disabled={isUploading}
            className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Attach file"
          >
            {isUploading ? (
              <div className="h-5 w-5 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleEmojiPicker}
            className="p-2 rounded-lg hover:bg-muted transition-colors relative"
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
              className="w-full px-4 py-2 rounded-full bg-muted border focus:outline-none focus:ring-2 focus:ring-primary text-responsive-sm"
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
        
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        />
        
        {/* Emoji Picker */}
        <EmojiPicker 
          onEmojiSelect={handleEmojiSelect}
          isVisible={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
        />
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

      {/* Forward Message Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 z-[6000] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-md bg-card rounded-2xl border shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b">
              <h3 className="text-responsive-lg font-semibold">Forward message</h3>
              <button
                onClick={() => setShowForwardModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
                aria-label="Close forward modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 sm:p-4 flex-1 overflow-y-auto">
              {friends.length === 0 ? (
                <div className="text-center text-muted-foreground text-responsive-sm">
                  You have no friends to forward this message to.
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map(friend => (
                    <button
                      key={friend.uid}
                      type="button"
                      onClick={() => toggleSelectForwardUser(friend.uid)}
                      className={`w-full flex items-center justify-between gap-3 p-2 rounded-lg border transition-colors ${
                        selectedForwardUserIds.has(friend.uid)
                          ? 'bg-primary/5 border-primary'
                          : 'bg-card hover:bg-muted border-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={friend.photoURL} alt={friend.name} />
                          <AvatarFallback className="bg-secondary text-xs">
                            {friend.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-responsive-sm text-left truncate">{friend.name}</span>
                      </div>
                      <div className={`h-6 w-6 rounded-full border flex items-center justify-center ${
                        selectedForwardUserIds.has(friend.uid)
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted-foreground text-transparent'
                      }`}>
                        <CheckIcon className="h-4 w-4" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 sm:p-4 border-t flex justify-end">
              <button
                type="button"
                onClick={handleForwardToSelected}
                disabled={selectedForwardUserIds.size === 0}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-responsive-sm"
              >
                Forward
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
