"use client";
import { Plus, Home, MessageSquare, Users, Bell, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

// A simple circular icon button used in the left rail
function RailIcon({
  icon: Icon,
  label,
  active = false
}) {
  return (
    <button
      aria-label={label}
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
        <button
          aria-label="New"
          className="grid h-12 w-12 place-items-center rounded-full border bg-secondary hover:bg-muted">
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
