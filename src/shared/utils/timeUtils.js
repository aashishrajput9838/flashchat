/**
 * Format last seen time
 * @param {Date|number|string} lastSeen - The last seen timestamp
 * @returns {string} Formatted last seen string
 */
export const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return 'Offline';
  
  try {
    const date = lastSeen instanceof Date 
      ? lastSeen 
      : typeof lastSeen === 'string' 
        ? new Date(lastSeen) 
        : lastSeen && lastSeen.toDate && typeof lastSeen.toDate === 'function'
          ? lastSeen.toDate() 
          : new Date(lastSeen);
          
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  } catch (e) {
    return 'Offline';
  }
};