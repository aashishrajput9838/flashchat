import { useState, useEffect } from 'react';
import { Phone, Video, X } from 'lucide-react';
import { subscribeToNotifications, getCurrentUser } from '@/lib/userService';

export function CallNotification({ onAccept, onDecline }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const user = getCurrentUser();

  // Subscribe to notifications to listen for incoming calls
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotifications((notifications) => {
      // Find the most recent unread call notification
      const callNotifications = notifications.filter(
        notif => (notif.type === 'video_call' || notif.type === 'audio_call') && 
                 notif.status === 'ringing' && 
                 !notif.read
      );
      
      if (callNotifications.length > 0) {
        // Get the most recent call notification
        const latestCall = callNotifications[0];
        setIncomingCall(latestCall);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  const handleAccept = () => {
    if (incomingCall && onAccept) {
      onAccept(incomingCall);
      setIncomingCall(null);
    }
  };

  const handleDecline = () => {
    if (incomingCall && onDecline) {
      onDecline(incomingCall);
      setIncomingCall(null);
    }
  };

  if (!incomingCall) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-80 bg-card border rounded-xl shadow-lg">
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
            onClick={handleDecline}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleDecline}
            className="flex-1 py-2 px-4 bg-secondary rounded-lg hover:bg-muted"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}