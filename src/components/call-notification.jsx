import { useState, useEffect } from 'react';
import { Phone, Video, X } from 'lucide-react';
import { subscribeToNotifications, getCurrentUser, markNotificationAsRead } from '@/lib/userService';

export function CallNotification({ onAccept, onDecline }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const user = getCurrentUser();

  // Subscribe to notifications to listen for incoming calls
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotifications(async (notifications) => {
      // Only consider very recent, unread, ringing call notifications
      const now = Date.now();
      const RECENCY_MS = 2 * 60 * 1000; // 2 minutes

      const callNotifications = notifications.filter((notif) => {
        if (!notif || notif.read) return false;
        if (!(notif.type === 'video_call' || notif.type === 'audio_call')) return false;
        if (notif.status !== 'ringing') return false;

        // Normalize timestamp to a number
        let ts = notif.timestamp;
        let t = null;
        try {
          if (ts?.toDate) {
            t = ts.toDate().getTime();
          } else if (typeof ts === 'string') {
            t = new Date(ts).getTime();
          } else if (ts instanceof Date) {
            t = ts.getTime();
          }
        } catch {}

        // If timestamp missing or too old, mark as read to avoid perpetual popups
        if (!t || isNaN(t) || now - t > RECENCY_MS) {
          try { await markNotificationAsRead(notif); } catch {}
          return false;
        }

        return true;
      });

      if (callNotifications.length > 0) {
        const latestCall = callNotifications[0];
        setIncomingCall(latestCall);
      } else {
        setIncomingCall(null);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  const handleAccept = async () => {
    if (incomingCall && onAccept) {
      try { await markNotificationAsRead(incomingCall); } catch {}
      onAccept(incomingCall);
      setIncomingCall(null);
    }
  };

  const handleDecline = async () => {
    if (incomingCall && onDecline) {
      try { await markNotificationAsRead(incomingCall); } catch {}
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