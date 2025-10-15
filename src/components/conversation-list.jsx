import { Search, UserPlus, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect } from "react"
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

  useEffect(() => {
    // Subscribe to friends only from Firestore to create chat list
    const unsubscribeFriends = subscribeToFriends((friends) => {
      // Transform friends data to match the expected format
      const chatList = friends
        .map(friend => ({
          name: friend.name || friend.displayName || friend.email || `User${friend.uid.substring(0, 5)}`,
          preview: "Send a message...",
          initials: friend.name || friend.displayName || friend.email 
            ? (friend.name || friend.displayName || friend.email).split(" ").map(n => n[0]).join("").slice(0, 2)
            : "U",
          uid: friend.uid,
          photoURL: friend.photoURL || "/diverse-avatars.png" // Add fallback
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
            photoURL: currentUser.photoURL || "/diverse-avatars.png" // Add fallback
          });
        }
      }
      
      setChats(chatList);
    });

    // Subscribe to all users for search functionality
    const unsubscribeUsers = subscribeToUsers((users) => {
      setAllUsers(users);
    });

    // Clean up listeners on component unmount
    return () => {
      if (unsubscribeFriends) {
        unsubscribeFriends();
      }
      if (unsubscribeUsers) {
        unsubscribeUsers();
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
  }, [userSearchQuery, allUsers, chats, currentUser]);

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
      if (error.message === 'User with this email not found') {
        setFriendRequestStatus('User not found. Please check the email address.');
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
            photoURL: user.photoURL || "/diverse-avatars.png"
          }));
        
        // Combine both lists
        return [...matchedChats, ...matchedUsers];
      })()
    : chats;

  return (
    <div
      className="flex h-[70vh] min-h-[640px] flex-col gap-3 rounded-xl border bg-card p-3 md:p-4 lg:h-[calc(100dvh-48px)]">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-semibold">FlashChat</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddFriend(!showAddFriend)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm hover:bg-secondary"
            aria-label="Add friend">
            <UserPlus className="h-4 w-4" />
            <span className="hidden md:inline">Add Friend</span>
          </button>
        </div>
      </div>
      
      {/* Add Friend Form */}
      {showAddFriend && (
        <div className="rounded-lg border bg-secondary/50 p-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Add New Friend</h3>
            <button 
              onClick={() => {
                setShowAddFriend(false);
                setFriendRequestStatus('');
                setUserSearchQuery('');
                setFilteredUsers([]);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* User search input - This is now the only input */}
          <div className="mb-2">
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="Search users by name or email"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          
          {/* Filtered users list */}
          {filteredUsers.length > 0 && (
            <div className="mb-2 max-h-60 overflow-y-auto border rounded-lg bg-background">
              {filteredUsers.map(user => (
                <div
                  key={user.uid}
                  onClick={() => handleSelectUser(user)}
                  className="flex items-center gap-2 p-2 hover:bg-secondary cursor-pointer"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage alt={user.name} src={user.photoURL || "/diverse-avatars.png"} />
                    <AvatarFallback>
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">{user.name || user.displayName || user.email}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Status message */}
          {friendRequestStatus && (
            <div className="mt-2 text-xs text-muted-foreground">
              {friendRequestStatus}
            </div>
          )}
        </div>
      )}
      
      {/* Search */}
      <label className="group relative block flex-shrink-0">
        <span className="sr-only">Search chats</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border bg-secondary/60 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:bg-secondary"
          placeholder="Search chats or users..." />
      </label>
      {/* Chats list */}
      <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {filteredChats.map((c, i) => (
          <button
            key={c.uid || i}
            onClick={() => handleSelectChat(c)}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
              c.preview === "Not a friend yet - Click to start chat" 
                ? "bg-warning/20 hover:bg-warning/30 border-warning/30" 
                : "bg-secondary/50 hover:bg-secondary"
            }`}>
            <div className="relative">
              <Avatar className="h-9 w-9">
                <AvatarImage alt={`${c.name} avatar`} src={c.photoURL} />
                <AvatarFallback>{c.initials}</AvatarFallback>
              </Avatar>
              {/* Presence dot */}
              <span
                aria-hidden
                className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full border border-background bg-chart-2" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {c.name}
                {c.uid === currentUser?.uid && " (You)"}
              </div>
              <div className="truncate text-xs text-muted-foreground">{c.preview}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}