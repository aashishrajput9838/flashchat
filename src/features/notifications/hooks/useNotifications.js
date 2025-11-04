import { useState, useEffect } from 'react';
import { 
  initNotificationService, 
  requestNotificationPermission,
  getUserNotificationSettings
} from '../services/notificationService';
import { getCurrentUser } from '@/features/user/services/userService';

export const useNotifications = () => {
  const [permissionStatus, setPermissionStatus] = useState('default'); // 'default', 'granted', 'denied'
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        setLoading(true);
        
        // Initialize the notification service
        await initNotificationService();
        
        // Check current permission status
        if ('Notification' in window) {
          setPermissionStatus(Notification.permission);
        }
        
        // Load user settings
        const user = getCurrentUser();
        if (user) {
          const userSettings = await getUserNotificationSettings(user.uid);
          setSettings(userSettings);
        }
      } catch (err) {
        console.error('Error initializing notifications:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initializeNotifications();
  }, []);

  const requestPermission = async () => {
    try {
      const token = await requestNotificationPermission();
      if (token) {
        setPermissionStatus('granted');
        return { success: true, token };
      } else {
        setPermissionStatus('denied');
        return { success: false, token: null };
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const refreshSettings = async () => {
    try {
      const user = getCurrentUser();
      if (user) {
        const userSettings = await getUserNotificationSettings(user.uid);
        setSettings(userSettings);
      }
    } catch (err) {
      console.error('Error refreshing notification settings:', err);
      setError(err.message);
    }
  };

  return {
    permissionStatus,
    settings,
    loading,
    error,
    requestPermission,
    refreshSettings
  };
};