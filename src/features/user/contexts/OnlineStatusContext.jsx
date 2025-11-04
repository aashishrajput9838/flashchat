import React, { createContext, useContext, useState, useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/features/auth/hooks/useAuth';

const OnlineStatusContext = createContext();

export const OnlineStatusProvider = ({ children }) => {
  const [onlineUsers, setOnlineUsers] = useState(new Map());
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Listen for online status updates
    const unsubscribe = onSnapshot(doc(db, 'user-status', user.uid), (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setOnlineUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(user.uid, {
            isOnline: userData.isOnline,
            lastSeen: userData.lastSeen?.toDate()
          });
          return newMap;
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  const isUserOnline = (userId) => {
    const userData = onlineUsers.get(userId);
    if (!userData) return false;
    
    // Consider user online if they were active in the last 5 minutes
    if (userData.isOnline && userData.lastSeen) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      return userData.lastSeen > fiveMinutesAgo;
    }
    
    return userData.isOnline || false;
  };

  const getLastSeen = (userId) => {
    const userData = onlineUsers.get(userId);
    return userData?.lastSeen || null;
  };

  return (
    <OnlineStatusContext.Provider value={{ 
      onlineUsers, 
      isUserOnline, 
      getLastSeen 
    }}>
      {children}
    </OnlineStatusContext.Provider>
  );
};

export const useOnlineStatus = () => {
  const context = useContext(OnlineStatusContext);
  if (!context) {
    throw new Error('useOnlineStatus must be used within an OnlineStatusProvider');
  }
  return context;
};