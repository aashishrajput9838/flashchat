import { useEffect } from 'react';
import { initNotificationService } from '@/features/notifications/services/notificationService';

/**
 * Hook to initialize and manage browser notifications
 */
export const useNotifications = () => {
  useEffect(() => {
    // Initialize notification service when component mounts
    initNotificationService();
    
    // Clean up function (if needed)
    return () => {
      // Any cleanup code would go here
    };
  }, []);
};