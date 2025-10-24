import { Search, UserPlus, X, Clock } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { OnlineStatus } from "@/components/ui/online-status"
import { useState, useEffect, useRef } from "react"
import { subscribeToFriends, getCurrentUser, sendFriendRequest, subscribeToUsers } from "@/lib/userService"

export function ConversationList({ onSelectChat }) {
  const [chats, setChats] = useState([])
  const [allUsers, setAllUsers] = useState([]) // Store all registered users
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [friendRequestStatus, setFriendRequestStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('') // Add search state
  const [userSearchQuery, setUserSearchQuery] = useState('') // Search for users in add friend section
  const [filteredUsers, setFilteredUsers] = useState([]) // Filtered users for add friend section
  const currentUser = getCurrentUser()
  const currentUserId = currentUser?.uid // Extract the UID for dependency array
  const friendsSubscriptionRef = useRef(null)
  const usersSubscriptionRef = useRef(null)

  useEffect(() => {
    // Clean up previous subscriptions
    if (friendsSubscriptionRef.current) {
      friendsSubscriptionRef.current();
      friendsSubscriptionRef.current = null;
    }
    
    if (usersSubscriptionRef.current) {
      usersSubscriptionRef.current();
      usersSubscriptionRef.current = null;
    }

    // Subscribe to friends only from Firestore to create chat list
    friendsSubscriptionRef.current = subscribeToFriends((friends) => {
      // Transform friends data to match the expected format
      const chatList = (Array.isArray(friends) ? friends : [])
        .map(friend => ({
          name: friend.name || friend.displayName || friend.email || `User${friend.uid.substring(0, 5)}`,
          preview: "Send a message...",
          initials: friend.name || friend.displayName || friend.email 
            ? (friend.name || friend.displayName || friend.email).split(" ").map(n => n[0]).join("").slice(0, 2)
            : "U",
          uid: friend.uid,
          photoURL: friend.photoURL || "/diverse-avatars.png", // Add fallback
          lastSeen: friend.lastSeen || null,
          isOnline: friend.isOnline || false
        }));
      
      // Add current user to the list
      if (currentUser) {
        // Check if current user is already in the list
        const currentUserInList = chatList.find(chat => chat.uid === currentUser.uid);
        if (!currentUserInList) {
          // Add current user if not in the list
          chatList.push({
            name: currentUser.displayName || currentUser.email || `User${currentUser.uid.substring(0, 5)}`,
            preview: "Send a message...",
            initials: currentUser.displayName || currentUser.email 
              ? (currentUser.displayName || currentUser.email).split(" ").map(n => n[0]).join("").slice(0, 2)
              : "U",
            uid: currentUser.uid,
            photoURL: currentUser.photoURL || "/diverse-avatars.png", // Add fallback
            lastSeen: new Date(),
            isOnline: true
          });
        }
      }
      
      setChats(chatList);
    });

    // Subscribe to all users for search functionality
    usersSubscriptionRef.current = subscribeToUsers((users) => {
      setAllUsers(Array.isArray(users) ? users : []);
    });

    // Clean up listeners on component unmount
    return () => {
      if (friendsSubscriptionRef.current) {
        friendsSubscriptionRef.current();
        friendsSubscriptionRef.current = null;
      }
      
      if (usersSubscriptionRef.current) {
        usersSubscriptionRef.current();
        usersSubscriptionRef.current = null;
      }
    };
  }, [currentUserId]); // Use currentUserId instead of currentUser object

  // Filter users when search query changes
  useEffect(() => {
    if (userSearchQuery.trim() === '') {
      setFilteredUsers([]);
      return;
    }
    
    const filtered = allUsers
      .filter(user => {
        // Exclude current user
        if (user.uid === currentUser?.uid) return false;
        // Exclude users already in friends list
        return !chats.some(chat => chat.uid === user.uid);
      })
      .filter(user => 
        user.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        user.displayName?.toLowerCase().includes(userSearchQuery.toLowerCase())
      );
      // Removed .slice(0, 5) to show all matching users
    
    setFilteredUsers(filtered);
  }, [userSearchQuery, allUsers, chats, currentUserId]);

  // Function to handle chat selection
  const handleSelectChat = (chat) => {
    if (onSelectChat) {
      onSelectChat(chat);
    }
  };

  // Function to handle adding a new friend
  const handleAddFriend = async (email) => {
    if (!email) {
      setFriendRequestStatus('Please select a user');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFriendRequestStatus('Invalid email address');
      return;
    }

    // Prevent users from adding themselves
    if (currentUser && email === currentUser.email) {
      setFriendRequestStatus('You cannot add yourself as a friend');
      return;
    }

    setFriendRequestStatus('Sending friend request...');
    
    try {
      // Send friend request
      await sendFriendRequest(email);
      
      setFriendRequestStatus(`Friend request sent to ${email}!`);
      
      // Hide the add friend form after 2 seconds
      setTimeout(() => {
        setShowAddFriend(false);
        setFriendRequestStatus('');
        setUserSearchQuery('');
        setFilteredUsers([]);
      }, 2000);
    } catch (error) {
      console.error('Friend request error:', error);
      if (error.message === 'User with this email not found') {
        setFriendRequestStatus('User not found. Please check the email address.');
      } else if (error.message === 'Permission denied. You may not have access to send friend requests.') {
        setFriendRequestStatus('Permission denied. Please check your account permissions.');
      } else if (error.message === 'Too many requests. Please wait a moment and try again.') {
        setFriendRequestStatus('Too many requests. Please wait a moment and try again.');
      } else {
        setFriendRequestStatus('Failed to send friend request. Please try again.');
      }
    }
  };

  // Function to select a user from search results
  const handleSelectUser = (user) => {
    handleAddFriend(user.email);
  };

  // Filter chats based on search query - enhanced to search all users
  const filteredChats = searchQuery 
    ? (() => {
        // First, filter existing chats (friends + current user)
        const matchedChats = chats.filter(chat => 
          chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          chat.preview.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        // Then, search all users who are not already in the chats list
        const matchedUsers = allUsers
          .filter(user => {
            // Skip current user and users already in chats
            if (user.uid === currentUser?.uid) return false;
            return !chats.some(chat => chat.uid === user.uid);
          })
          .filter(user => 
            user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map(user => ({
            name: user.name || user.displayName || user.email || `User${user.uid.substring(0, 5)}`,
            preview: "Not a friend yet - Click to start chat",
            initials: user.name || user.displayName || user.email 
              ? (user.name || user.displayName || user.email).split(" ").map(n => n[0]).join("").slice(0, 2)
              : "U",
            uid: user.uid,
            photoURL: user.photoURL || "/diverse-avatars.png",
            isOnline: user.isOnline || false
          }));
        
        // Combine both lists
        return [...matchedChats, ...matchedUsers];
      })()
    : chats;

  // Format last seen time
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return '';
    const now = new Date();
    const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border shadow-sm mobile-chat-list">
      {/* Header */}
      <div className="p-3 sm:p-4 md:p-5 border-b">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-responsive-lg font-semibold">Conversations</h2>
          <button 
            onClick={() => setShowAddFriend(true)}
            className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors"
            aria-label="Add friend"
          >
            <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
        
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted border focus:outline-none focus:ring-2 focus:ring-primary text-responsive-sm"
          />
        </div>
      </div>

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div className="fixed inset-0 z-[6000] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-md bg-card rounded-2xl border shadow-2xl">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b">
              <h3 className="text-responsive-lg font-semibold">Add Friend</h3>
              <button
                onClick={() => {
                  setShowAddFriend(false);
                  setFriendRequestStatus('');
                  setUserSearchQuery('');
                  setFilteredUsers([]);
                }}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-3 sm:p-4">
              <div className="relative mb-3 sm:mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by email or name..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted border focus:outline-none focus:ring-2 focus:ring-primary text-responsive-sm"
                />
              </div>
              
              {friendRequestStatus && (
                <div className="mb-3 sm:mb-4 p-3 rounded-lg bg-secondary text-center text-responsive-sm">
                  {friendRequestStatus}
                </div>
              )}
              
              {filteredUsers.length > 0 && (
                <div className="max-h-60 overflow-y-auto">
                  <h4 className="text-responsive-sm font-medium mb-2 text-muted-foreground">Search Results</h4>
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <div 
                        key={user.uid}
                        onClick={() => handleSelectUser(user)}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.photoURL} alt={user.name} />
                          <AvatarFallback className="bg-secondary">
                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-responsive-sm">{user.name || user.displayName || user.email}</div>
                          <div className="text-muted-foreground truncate text-responsive-xs">{user.email}</div>
                        </div>
                        <button className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-responsive-sm">
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {userSearchQuery && filteredUsers.length === 0 && (
                <div className="text-center py-6 sm:py-8 text-muted-foreground">
                  <UserPlus className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2" />
                  <p className="text-responsive-sm">No users found</p>
                  <p className="text-responsive-xs">Try a different search term</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 sm:p-8 text-center text-muted-foreground">
            <Search className="h-10 w-10 sm:h-12 sm:w-12 mb-3 sm:mb-4 mx-auto" />
            <h3 className="text-responsive-lg font-medium mb-1">No conversations yet</h3>
            <p className="text-responsive-sm">Start a conversation with a friend or add new friends</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredChats.map((chat) => (
              <div
                key={chat.uid}
                onClick={() => handleSelectChat(chat)}
                className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={chat.photoURL} alt={chat.name} />
                    <AvatarFallback className="bg-secondary">
                      {chat.initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate text-responsive-sm">{chat.uid === currentUser?.uid ? 'Me' : chat.name}</div>
                    {chat.lastSeen && (
                      <div className="text-muted-foreground text-responsive-xs">
                        {formatLastSeen(chat.lastSeen)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-muted-foreground truncate text-responsive-xs">{chat.preview}</p>
                    <OnlineStatus isOnline={chat.isOnline} lastSeen={chat.lastSeen} showText={true} size="sm" user={chat.uid === currentUser?.uid ? currentUser : chat} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}