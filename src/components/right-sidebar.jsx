import { Phone, Video, Camera, Link, User, Mail, Bell } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect } from "react"
import { subscribeToUsers, getCurrentUser, subscribeToFriendRequests, acceptFriendRequest, declineFriendRequest, subscribeToNotifications, markNotificationAsRead } from "@/lib/userService"

export function RightSidebar({ onUserClick }) {
  const [members, setMembers] = useState([])
  const [friendRequests, setFriendRequests] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [friendRequestStatus, setFriendRequestStatus] = useState({})
  const [notificationStatus, setNotificationStatus] = useState({})
  const currentUser = getCurrentUser()

  useEffect(() => {
    // Subscribe to all users from Firestore
    const unsubscribeUsers = subscribeToUsers((users) => {
      // Transform users data to match the expected format
      const memberList = users.map(user => ({
        name: user.name || user.displayName || user.email || `User${user.uid.substring(0, 5)}`,
        role: user.uid === currentUser?.uid ? "You" : "",
        email: user.email,
        photoURL: user.photoURL,
        uid: user.uid
      }));
      
      // Sort to put current user at the top
      memberList.sort((a, b) => {
        if (a.role === "You") return -1;
        if (b.role === "You") return 1;
        return 0;
      });
      
      setMembers(memberList);
    });

    // Subscribe to friend requests
    const unsubscribeFriendRequests = subscribeToFriendRequests((requests) => {
      setFriendRequests(requests);
    });

    // Subscribe to notifications
    const unsubscribeNotifications = subscribeToNotifications((notifications) => {
      setNotifications(notifications);
    });

    // Clean up listeners on component unmount
    return () => {
      if (unsubscribeUsers) {
        unsubscribeUsers();
      }
      if (unsubscribeFriendRequests) {
        unsubscribeFriendRequests();
      }
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
      }
    };
  }, []);

  // Function to handle user click
  const handleUserClick = (user) => {
    if (onUserClick) {
      onUserClick(user);
    }
  };

  // Function to accept a friend request
  const handleAcceptRequest = async (request) => {
    try {
      setFriendRequestStatus(prev => ({ ...prev, [request.from]: 'Accepting...' }));
      await acceptFriendRequest(request);
      setFriendRequestStatus(prev => ({ ...prev, [request.from]: 'Accepted!' }));
      // Remove status message after 2 seconds
      setTimeout(() => {
        setFriendRequestStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[request.from];
          return newStatus;
        });
      }, 2000);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      setFriendRequestStatus(prev => ({ ...prev, [request.from]: 'Failed to accept' }));
    }
  };

  // Function to decline a friend request
  const handleDeclineRequest = async (request) => {
    try {
      setFriendRequestStatus(prev => ({ ...prev, [request.from]: 'Declining...' }));
      await declineFriendRequest(request);
      setFriendRequestStatus(prev => ({ ...prev, [request.from]: 'Declined!' }));
      // Remove status message after 2 seconds
      setTimeout(() => {
        setFriendRequestStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[request.from];
          return newStatus;
        });
      }, 2000);
    } catch (error) {
      console.error('Error declining friend request:', error);
      setFriendRequestStatus(prev => ({ ...prev, [request.from]: 'Failed to decline' }));
    }
  };

  // Function to mark a notification as read
  const handleMarkAsRead = async (notification) => {
    try {
      setNotificationStatus(prev => ({ ...prev, [notification.timestamp]: 'Marking as read...' }));
      await markNotificationAsRead(notification);
      setNotificationStatus(prev => ({ ...prev, [notification.timestamp]: 'Marked as read!' }));
      // Remove status message after 2 seconds
      setTimeout(() => {
        setNotificationStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[notification.timestamp];
          return newStatus;
        });
      }, 2000);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setNotificationStatus(prev => ({ ...prev, [notification.timestamp]: 'Failed to mark as read' }));
    }
  };

  // Function to toggle notifications visibility
  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  return (
    <div
      className="flex h-[70vh] min-h-[640px] flex-col gap-3 rounded-xl border bg-card p-3 md:p-4 lg:h-[calc(100dvh-48px)]">
      {/* User Profile */}
      {currentUser && (
        <section className="rounded-xl border bg-card p-3 md:p-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage alt="Your avatar" src={currentUser.photoURL || "/diverse-avatars.png"} />
              <AvatarFallback>
                {currentUser.displayName
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2) || currentUser.email?.substring(0, 2).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{currentUser.displayName || "User"}</div>
              <div className="truncate text-xs text-muted-foreground">{currentUser.email}</div>
            </div>
            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={toggleNotifications}
                className="p-2 rounded-full hover:bg-secondary"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500"></span>
                )}
              </button>
            </div>
          </div>
          
          {/* Notifications Panel */}
          {showNotifications && (
            <div className="mt-3 rounded-lg border bg-secondary/50 p-3 max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Notifications</h4>
                <span className="text-xs text-muted-foreground">{notifications.length} items</span>
              </div>
              {notifications.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">No notifications</div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notification, index) => (
                    <div 
                      key={index} 
                      className={`p-2 rounded-lg text-xs ${notification.read ? 'bg-background' : 'bg-primary/10'}`}
                    >
                      <div className="flex justify-between">
                        <div className="font-medium">{notification.fromName}</div>
                        {!notification.read && (
                          <button 
                            onClick={() => handleMarkAsRead(notification)}
                            className="text-primary hover:underline"
                          >
                            {notificationStatus[notification.timestamp] || 'Mark as read'}
                          </button>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-1">{notification.message}</div>
                      <div className="text-muted-foreground text-xs mt-1">
                        {notification.timestamp && notification.timestamp.toDate 
                          ? notification.timestamp.toDate().toLocaleString() 
                          : new Date(notification.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
      
      {/* Friend Requests Section */}
      {friendRequests.length > 0 && (
        <section className="rounded-xl border bg-card p-3 md:p-4 flex-shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-medium">Friend Requests</h4>
            <span className="text-xs text-muted-foreground">{friendRequests.length}</span>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {friendRequests.map((request, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{request.fromName || request.fromEmail}</div>
                  <div className="truncate text-xs text-muted-foreground">{request.fromEmail}</div>
                </div>
                <div className="flex gap-1">
                  {friendRequestStatus[request.from] ? (
                    <div className="text-xs text-muted-foreground px-2 py-1">
                      {friendRequestStatus[request.from]}
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleAcceptRequest(request)}
                        className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(request)}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      
      {/* Quick actions */}
      <section className="rounded-xl border bg-card p-3 md:p-4 flex-shrink-0">
        <div className="mb-3 text-sm font-medium">Actions</div>
        <div className="grid grid-cols-4 gap-2">
          <button
            className="grid aspect-square place-items-center rounded-xl border bg-secondary hover:bg-muted"
            aria-label="Call">
            <Phone className="h-5 w-5" />
          </button>
          <button
            className="grid aspect-square place-items-center rounded-xl border bg-secondary hover:bg-muted"
            aria-label="Video">
            <Video className="h-5 w-5" />
          </button>
          <button
            className="grid aspect-square place-items-center rounded-xl border bg-secondary hover:bg-muted"
            aria-label="Screen share">
            <Camera className="h-5 w-5" />
          </button>
          <button
            className="grid aspect-square place-items-center rounded-xl border bg-secondary hover:bg-muted"
            aria-label="Links">
            <Link className="h-5 w-5" />
          </button>
        </div>
      </section>
      
      {/* Members */}
      <section className="min-h-0 flex-1 rounded-xl border bg-card p-3 md:p-4 flex flex-col">
        <div className="mb-3 flex items-center justify-between flex-shrink-0">
          <h4 className="text-sm font-medium">Members</h4>
          <span className="text-xs text-muted-foreground">{members.length} users</span>
        </div>
        <div className="space-y-2 overflow-auto pr-1 flex-grow">
          {members.map((m, index) => (
            <div
              key={m.uid || index}
              onClick={() => handleUserClick(m)}
              className="flex items-center gap-3 rounded-lg border bg-secondary/40 p-2 cursor-pointer hover:bg-secondary transition-colors">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage alt="" src={m.photoURL || "/diverse-avatars.png"} />
                  <AvatarFallback>
                    {m.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span
                  aria-hidden
                  className="absolute bottom-0 right-0 block h-2 w-2 rounded-full border border-background bg-chart-2" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.role || "Member"}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}