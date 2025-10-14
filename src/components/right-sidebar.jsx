import { Phone, Video, Camera, Link, User, Mail } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect } from "react"
import { subscribeToUsers, getCurrentUser } from "@/lib/userService"

export function RightSidebar({ onUserClick }) {
  const [members, setMembers] = useState([])
  const currentUser = getCurrentUser()

  useEffect(() => {
    // Subscribe to users from Firestore
    const unsubscribe = subscribeToUsers((users) => {
      // Transform users data to match the expected format
      const memberList = users.map(user => ({
        name: user.name || user.displayName || user.email || `User${user.uid.substring(0, 5)}`,
        role: user.uid === currentUser?.uid ? "You" : "",
        email: user.email,
        photoURL: user.photoURL,
        uid: user.uid
      }));
      
      // Add current user to the top if not already in the list
      if (currentUser && !memberList.some(m => m.role === "You")) {
        memberList.unshift({
          name: currentUser.displayName || currentUser.email || `User${currentUser.uid.substring(0, 5)}`,
          role: "You",
          email: currentUser.email,
          photoURL: currentUser.photoURL || currentUser.photoURL, // Ensure we use the correct photoURL
          uid: currentUser.uid
        });
      }
      
      setMembers(memberList);
    });

    // Clean up listener on component unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser]);

  // Function to handle user click
  const handleUserClick = (user) => {
    if (onUserClick) {
      onUserClick(user);
    }
  };

  return (
    <div
      className="flex h-[70vh] min-h-[640px] flex-col gap-3 lg:h-[calc(100dvh-48px)]">
      {/* User Profile */}
      {currentUser && (
        <section className="rounded-xl border bg-card p-3 md:p-4">
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
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{currentUser.displayName || "User"}</div>
              <div className="truncate text-xs text-muted-foreground">{currentUser.email}</div>
            </div>
          </div>
        </section>
      )}
      
      {/* Quick actions */}
      <section className="rounded-xl border bg-card p-3 md:p-4">
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
      <section className="min-h-0 flex-1 rounded-xl border bg-card p-3 md:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-medium">Members</h4>
          <span className="text-xs text-muted-foreground">{members.length}</span>
        </div>
        <div className="space-y-2 overflow-auto pr-1">
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
      {/* Files */}
      <section className="rounded-xl border bg-card p-3 md:p-4">
        <div className="mb-3 text-sm font-medium">Files</div>
        <div className="space-y-3">
          <div
            className="rounded-lg border bg-secondary/50 p-3 text-xs text-muted-foreground">
            115 photos • 208 files • 47 shared links
          </div>
          <div className="overflow-hidden rounded-xl border">
            <img
              src="/images/flashchat-hero.png"
              alt="Shared file preview"
              className="aspect-[16/9] w-full object-cover" />
          </div>
        </div>
      </section>
    </div>
  );
}