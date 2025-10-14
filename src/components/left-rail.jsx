"use client";
import { Plus, Home, MessageSquare, Users, Bell, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { signOutUser } from "@/lib/userService"

// A simple circular icon button used in the left rail
function RailIcon({
  icon: Icon,
  label,
  active = false,
  onClick
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative grid h-12 w-12 place-items-center rounded-full border",
        "bg-sidebar text-sidebar-foreground",
        "transition-colors",
        active ? "bg-secondary" : "hover:bg-secondary"
      )}>
      <Icon className="h-5 w-5 opacity-90" />
    </button>
  );
}

export function LeftRail() {
  const handleLogout = async () => {
    try {
      await signOutUser();
      // Redirect to the root path which will show the login screen
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="flex h-full flex-row gap-3 lg:flex-col">
      {/* Brand coin */}
      <div
        className="grid h-12 w-12 place-items-center rounded-full border bg-secondary">
        <span className="text-sm font-semibold">FC</span>
      </div>
      <div className="hidden flex-1 flex-col gap-3 lg:flex">
        <RailIcon icon={Home} label="Home" />
        <RailIcon icon={MessageSquare} label="Chats" active />
        <RailIcon icon={Users} label="Teams" />
        <RailIcon icon={Bell} label="Notifications" />
        <RailIcon icon={Settings} label="Settings" />
      </div>
      <div className="ml-auto flex items-center gap-3 lg:ml-0 lg:mt-auto">
        <RailIcon icon={LogOut} label="Logout" onClick={handleLogout} />
        <button
          aria-label="New"
          className="grid h-12 w-12 place-items-center rounded-full border bg-secondary hover:bg-muted">
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}