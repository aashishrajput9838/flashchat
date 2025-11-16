import { useState, useEffect, useCallback, useRef } from 'react';
import { sendMessage, sendFileMessage, subscribeToMessages, markMessagesAsRead } from '@/features/chat/services/chatService';
import { getCurrentUser } from '@/features/user/services/userService';
import { uploadFile, createFileMessage } from '@/features/chat/services/fileService';

export const useChat = (selectedChat) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const messageSubscriptionRef = useRef(null);
  const user = getCurrentUser();
  const prevMessagesRef = useRef([]);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Subscribe to messages when selectedChat changes
  useEffect(() => {
    if (selectedChat && selectedChat.uid) {
      // Clean up previous subscription
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current();
      }
      
      // Subscribe to new messages
      messageSubscriptionRef.current = subscribeToMessages(selectedChat.uid, (newMessages) => {
        // Only update state if messages have actually changed
        const prevMessages = prevMessagesRef.current;
        if (JSON.stringify(prevMessages) !== JSON.stringify(newMessages)) {
          setMessages(newMessages);
          prevMessagesRef.current = newMessages;
        }
      });

      // Mark all messages from this user as read when opening the chat
      // so the sender sees blue double ticks.
      markMessagesAsRead(selectedChat.uid).catch((err) => {
        console.error('Error marking messages as read:', err);
      });
    }
    
    return () => {
      // Clean up subscription on unmount or when chat changes
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current();
        messageSubscriptionRef.current = null;
      }
      prevMessagesRef.current = [];
    };
  }, [selectedChat]);

  // Scroll to bottom when messages change
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scrollToBottom();
    });
    return () => cancelAnimationFrame(id);
  }, [messages, scrollToBottom]);

  // Handle sending a text message
  const handleSendMessage = useCallback((e) => {
    e?.preventDefault();
    if (!message.trim() || !selectedChat || isSending) return;

    const text = message.trim();

    // Optimistic UI: clear input immediately so Enter feels instant
    setMessage("");
    setIsSending(true);
    setError(null);

    // Run the heavy work in a separate task
    (async () => {
      try {
        // Create message data object
        const messageData = {
          text,
          name: user?.displayName || 'Anonymous',
          photoURL: user?.photoURL || null,
          you: true
        };

        // Send message with correct parameters
        await sendMessage(messageData, selectedChat.uid);
      } catch (err) {
        console.error("Error sending message:", err);
        setError(err.message || "Failed to send message");
        // Optionally restore text on failure:
        // setMessage(text);
      } finally {
        setIsSending(false);
      }
    })();
  }, [message, selectedChat, isSending, user]);

  // Handle sending a file message
  const handleSendFileMessage = useCallback(async (file) => {
    if (!file || !selectedChat || isUploading) return;
    
    setIsUploading(true);
    setError(null);
    
    try {
      // Upload file to local server
      const fileData = await uploadFile(file);
      
      // Create file message
      const fileMessage = createFileMessage(fileData);
      
      // Create message data object for file
      const messageData = {
        text: fileMessage.text,
        name: user?.displayName || 'Anonymous',
        photoURL: user?.photoURL || null,
        you: true,
        fileType: fileData.type,
        fileUrl: fileData.url,
        fileName: fileData.name
      };
      
      // Send file message
      await sendFileMessage(messageData, selectedChat.uid);
    } catch (err) {
      console.error("Error sending file message:", err);
      setError(err.message || "Failed to send file");
    } finally {
      setIsUploading(false);
    }
  }, [selectedChat, isUploading, user]);

  // Format message time
  const formatMessageTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    
    // Handle Firestore timestamp objects
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Handle regular Date objects or timestamp strings
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  return {
    messages,
    message,
    setMessage,
    isSending,
    isUploading,
    error,
    messagesEndRef,
    handleSendMessage,
    handleSendFileMessage,
    formatMessageTime,
    scrollToBottom
  };
};