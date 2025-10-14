import { Search, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect } from "react"
import { subscribeToFriends, getCurrentUser, sendFriendRequest } from "@/lib/userService"

export function ConversationList({ onSelectChat }) {
  const [chats, setChats] = useState([])
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [newFriendEmail, setNewFriendEmail] = useState('')
  const [friendRequestStatus, setFriendRequestStatus] = useState('')
  const currentUser = getCurrentUser()

  useEffect(() => {
    // Subscribe to friends only from Firestore to create chat list
    const unsubscribe = subscribeToFriends((friends) => {
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

    // Clean up listener on component unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser]);

  // Function to handle chat selection
  const handleSelectChat = (chat) => {
    if (onSelectChat) {
      onSelectChat(chat);
    }
  };

  // Function to handle adding a new friend
  const handleAddFriend = async () => {
    if (!newFriendEmail) {
      setFriendRequestStatus('Please enter an email address');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newFriendEmail)) {
      setFriendRequestStatus('Please enter a valid email address');
      return;
    }

    // Prevent users from adding themselves
    if (currentUser && newFriendEmail === currentUser.email) {
      setFriendRequestStatus('You cannot add yourself as a friend');
      return;
    }

    setFriendRequestStatus('Sending friend request...');
    
    try {
      // Send friend request
      await sendFriendRequest(newFriendEmail);
      
      setFriendRequestStatus(`Friend request sent to ${newFriendEmail}!`);
      setNewFriendEmail('');
      
      // Hide the add friend form after 2 seconds
      setTimeout(() => {
        setShowAddFriend(false);
        setFriendRequestStatus('');
      }, 2000);
    } catch (error) {
      if (error.message === 'User with this email not found') {
        setFriendRequestStatus('User with this email not found. Please check the email address.');
      } else {
        setFriendRequestStatus('Failed to send friend request. Please try again.');
      }
    }
  };

  return (
    <div
      className="flex h-[70vh] min-h-[640px] flex-col gap-3 rounded-xl border bg-card p-3 md:p-4 lg:h-[calc(100dvh-48px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">FlashChat</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddFriend(!showAddFriend)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm hover:bg-secondary"
            aria-label="Add friend">
            <UserPlus className="h-4 w-4" />
            <span className="hidden md:inline">Add Friend</span>
          </button>
          <div className="hidden text-sm text-muted-foreground md:block">Work</div>
        </div>
      </div>
      
      {/* Add Friend Form */}
      {showAddFriend && (
        <div className="rounded-lg border bg-secondary/50 p-3">
          <h3 className="mb-2 text-sm font-medium">Add New Friend</h3>
          <div className="flex gap-2">
            <input
              type="email"
              value={newFriendEmail}
              onChange={(e) => setNewFriendEmail(e.target.value)}
              placeholder="Enter friend's email"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={handleAddFriend}
              className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              Add
            </button>
          </div>
          {friendRequestStatus && (
            <div className="mt-2 text-xs text-muted-foreground">
              {friendRequestStatus}
            </div>
          )}
        </div>
      )}
      
      {/* Search */}
      <label className="group relative block">
        <span className="sr-only">Search chats</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="w-full rounded-lg border bg-secondary/60 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:bg-secondary"
          placeholder="Search" />
      </label>
      {/* Chats list */}
      <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {chats.map((c, i) => (
          <button
            key={c.uid || i}
            onClick={() => handleSelectChat(c)}
            className="flex w-full items-center gap-3 rounded-xl border bg-secondary/50 p-3 text-left transition-colors hover:bg-secondary">
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