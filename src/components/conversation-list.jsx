import { Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect } from "react"
import { subscribeToUsers, getCurrentUser } from "@/lib/userService"

export function ConversationList({ onSelectChat }) {
  const [chats, setChats] = useState([])
  const currentUser = getCurrentUser()

  useEffect(() => {
    // Subscribe to users from Firestore to create chat list
    const unsubscribe = subscribeToUsers((users) => {
      // Transform users data to match the expected format
      const chatList = users
        .map(user => ({
          name: user.name || user.displayName || user.email || `User${user.uid.substring(0, 5)}`,
          preview: "Send a message...",
          initials: user.name || user.displayName || user.email 
            ? (user.name || user.displayName || user.email).split(" ").map(n => n[0]).join("").slice(0, 2)
            : "U",
          uid: user.uid,
          photoURL: user.photoURL
        }));
      
      // Ensure current user is in the list with proper photoURL
      if (currentUser) {
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
            photoURL: currentUser.photoURL
          });
        } else {
          // Update current user's photoURL if it's missing or null
          if (!currentUserInList.photoURL && currentUser.photoURL) {
            currentUserInList.photoURL = currentUser.photoURL;
          }
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

  return (
    <div
      className="flex h-[70vh] min-h-[640px] flex-col gap-3 rounded-xl border bg-card p-3 md:p-4 lg:h-[calc(100dvh-48px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">FlashChat</h2>
        <div className="hidden text-sm text-muted-foreground md:block">Work</div>
      </div>
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
                <AvatarImage alt={`${c.name} avatar`} src={c.photoURL || "/placeholder.svg"} />
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