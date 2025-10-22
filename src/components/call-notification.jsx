import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Phone, Video, X } from 'lucide-react';
import { subscribeToNotifications, getCurrentUser, markNotificationAsRead } from '@/lib/userService';
import { listenForCallStatus } from '@/lib/callService';

export function CallNotification({ onAccept, onDecline }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const user = getCurrentUser();
  const callStatusUnsubscribeRef = useRef(null);

  // Subscribe to notifications to listen for incoming calls
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotifications((notifications) => {
      // Filter for unread, ringing call notifications
      const validCalls = notifications.filter(notif => 
        notif && 
        !notif.read && 
        (notif.type === 'video_call' || notif.type === 'audio_call') && 
        notif.status === 'ringing'
      );

      if (validCalls.length > 0) {
        // Use the most recent call
        const latestCall = validCalls[0];
        setIncomingCall(latestCall);
      } else {
        // No valid calls, clear the current one
        setIncomingCall(null);
      }
    });

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      // Clean up call status listener if it exists
      if (callStatusUnsubscribeRef.current) {
        callStatusUnsubscribeRef.current();
        callStatusUnsubscribeRef.current = null;
      }
    };
  }, [user]);

  const handleAccept = async () => {
    if (incomingCall && onAccept) {
      try { 
        await markNotificationAsRead(incomingCall); 
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
      
      // If this is a video call with a callId, listen for call status changes
      if (incomingCall.type === 'video_call' && incomingCall.callId) {
        // Clean up any existing listener
        if (callStatusUnsubscribeRef.current) {
          callStatusUnsubscribeRef.current();
        }
        
        // Listen for call status changes to automatically dismiss popup
        callStatusUnsubscribeRef.current = listenForCallStatus(incomingCall.callId, (data) => {
          if (data.status === 'ended' || data.status === 'accepted') {
            setIncomingCall(null);
            // Clean up the listener
            if (callStatusUnsubscribeRef.current) {
              callStatusUnsubscribeRef.current();
              callStatusUnsubscribeRef.current = null;
            }
          }
        });
      }
      
      // Pass the call data to the handler
      onAccept(incomingCall);
      
      // Immediately clear the call to dismiss the popup
      setIncomingCall(null);
    }
  };

  const handleDecline = async () => {
    if (incomingCall && onDecline) {
      try { 
        await markNotificationAsRead(incomingCall); 
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
      
      // Pass the call data to the handler
      onDecline(incomingCall);
      
      // Immediately clear the call to dismiss the popup
      setIncomingCall(null);
    }
  };

  // Auto-dismiss popup if call status changes to non-ringing
  useEffect(() => {
    if (incomingCall && incomingCall.callId) {
      const unsubscribe = listenForCallStatus(incomingCall.callId, (data) => {
        // If the call is no longer ringing, dismiss the popup
        if (data.status !== 'ringing') {
          setIncomingCall(null);
        }
      });
      
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }
  }, [incomingCall]);

  if (!incomingCall) {
    return null;
  }

  const popup = (
    <div
      className="fixed top-4 right-4 z-[2147483647] w-80 bg-card border rounded-xl shadow-lg pointer-events-auto touch-manipulation select-none"
      role="dialog"
      aria-label="Incoming call"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {incomingCall.type === 'video_call' ? (
              <div className="bg-blue-500 rounded-full p-2">
                <Video className="h-5 w-5 text-white" />
              </div>
            ) : (
              <div className="bg-green-500 rounded-full p-2">
                <Phone className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <h3 className="font-semibold">
                {incomingCall.callerName || 'Unknown Caller'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {incomingCall.type === 'video_call' ? 'Video call' : 'Audio call'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onTouchStart={(e) => { e.preventDefault(); handleDecline(); }}
            onTouchEnd={(e) => { e.preventDefault(); }}
            onPointerUp={(e) => { e.preventDefault(); handleDecline(); }}
            onClick={handleDecline}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onTouchStart={(e) => { e.preventDefault(); handleDecline(); }}
            onTouchEnd={(e) => { e.preventDefault(); }}
            onPointerUp={(e) => { e.preventDefault(); handleDecline(); }}
            onClick={handleDecline}
            className="flex-1 py-2 px-4 bg-secondary rounded-lg hover:bg-muted cursor-pointer"
          >
            Decline
          </button>
          <button
            type="button"
            onTouchStart={(e) => { e.preventDefault(); handleAccept(); }}
            onTouchEnd={(e) => { e.preventDefault(); }}
            onPointerUp={(e) => { e.preventDefault(); handleAccept(); }}
            onClick={handleAccept}
            className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:opacity-90 cursor-pointer"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}