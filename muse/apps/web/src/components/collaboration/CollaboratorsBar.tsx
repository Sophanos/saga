import { useState, useRef, useEffect } from "react";
import { Users, ChevronDown, Circle, UserPlus } from "lucide-react";
import { Button, ScrollArea } from "@mythos/ui";
import {
  useProjectMembers,
  useActiveCollaborators,
  useMyRole,
  type ProjectMember,
  type CollaboratorPresence,
} from "@mythos/state";

// ============================================================================
// Types
// ============================================================================

interface CollaboratorsBarProps {
  /** Callback when invite button is clicked */
  onInviteClick?: () => void;
  /** Maximum number of avatars to display before showing overflow count */
  maxAvatars?: number;
  /** Custom class name */
  className?: string;
}

interface AvatarProps {
  name?: string;
  avatarUrl?: string;
  color?: string;
  size?: "sm" | "md";
  isOnline?: boolean;
  showOnlineIndicator?: boolean;
}

// ============================================================================
// Avatar Component
// ============================================================================

function Avatar({
  name,
  avatarUrl,
  color,
  size = "sm",
  isOnline = false,
  showOnlineIndicator = false,
}: AvatarProps) {
  const sizeClasses = size === "sm" ? "w-7 h-7 text-xs" : "w-8 h-8 text-sm";
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="relative">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || "User avatar"}
          className={`${sizeClasses} rounded-full object-cover border-2 border-mythos-bg-primary`}
        />
      ) : (
        <div
          className={`${sizeClasses} rounded-full flex items-center justify-center font-medium border-2 border-mythos-bg-primary`}
          style={{
            backgroundColor: color || "#6366F1",
            color: "#fff",
          }}
        >
          {initials}
        </div>
      )}
      {showOnlineIndicator && (
        <Circle
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
            isOnline
              ? "fill-mythos-accent-green text-mythos-accent-green"
              : "fill-mythos-text-muted text-mythos-text-muted"
          }`}
        />
      )}
    </div>
  );
}

// ============================================================================
// Member List Item
// ============================================================================

interface MemberListItemProps {
  member: ProjectMember;
  isOnline: boolean;
  presence?: CollaboratorPresence;
}

function MemberListItem({ member, isOnline, presence }: MemberListItemProps) {
  const roleLabels: Record<string, string> = {
    owner: "Owner",
    editor: "Editor",
    viewer: "Viewer",
  };

  const roleBadgeColors: Record<string, string> = {
    owner: "bg-mythos-accent-yellow/20 text-mythos-accent-yellow",
    editor: "bg-mythos-accent-cyan/20 text-mythos-accent-cyan",
    viewer: "bg-mythos-text-muted/20 text-mythos-text-muted",
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-mythos-bg-primary/50 rounded-md transition-colors">
      <Avatar
        name={member.name}
        avatarUrl={member.avatarUrl}
        color={presence?.color}
        size="md"
        isOnline={isOnline}
        showOnlineIndicator
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-mythos-text-primary truncate">
            {member.name || member.email}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${roleBadgeColors[member.role]}`}
          >
            {roleLabels[member.role]}
          </span>
        </div>
        {member.name && member.email && (
          <span className="text-xs text-mythos-text-muted truncate block">
            {member.email}
          </span>
        )}
        {isOnline && presence?.documentId && (
          <span className="text-xs text-mythos-accent-green">
            Editing a document
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Collaborators Dropdown
// ============================================================================

interface CollaboratorsDropdownProps {
  members: ProjectMember[];
  activeCollaborators: CollaboratorPresence[];
  onInviteClick?: () => void;
  canInvite: boolean;
}

function CollaboratorsDropdown({
  members,
  activeCollaborators,
  onInviteClick,
  canInvite,
}: CollaboratorsDropdownProps) {
  const activeIds = new Set(activeCollaborators.map((c) => c.id));

  // Sort members: online first, then by name
  const sortedMembers = [...members].sort((a, b) => {
    const aOnline = activeIds.has(a.userId);
    const bOnline = activeIds.has(b.userId);
    if (aOnline !== bOnline) return bOnline ? 1 : -1;
    return (a.name || a.email).localeCompare(b.name || b.email);
  });

  const onlineCount = members.filter((m) => activeIds.has(m.userId)).length;

  return (
    <div className="w-72 bg-mythos-bg-secondary border border-mythos-text-muted/20 rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-mythos-text-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-mythos-text-primary">
              Team Members
            </h3>
            <p className="text-xs text-mythos-text-muted">
              {onlineCount} online, {members.length} total
            </p>
          </div>
          {canInvite && onInviteClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onInviteClick}
              className="gap-1 text-mythos-accent-cyan hover:text-mythos-accent-cyan/80"
            >
              <UserPlus className="w-4 h-4" />
              Invite
            </Button>
          )}
        </div>
      </div>

      {/* Member List */}
      <ScrollArea className="max-h-80">
        <div className="py-2">
          {sortedMembers.length > 0 ? (
            sortedMembers.map((member) => (
              <MemberListItem
                key={member.id}
                member={member}
                isOnline={activeIds.has(member.userId)}
                presence={activeCollaborators.find(
                  (c) => c.id === member.userId
                )}
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center text-mythos-text-muted">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No team members yet</p>
              {canInvite && (
                <p className="text-xs mt-1">
                  Invite collaborators to get started
                </p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Main CollaboratorsBar Component
// ============================================================================

export function CollaboratorsBar({
  onInviteClick,
  maxAvatars = 4,
  className = "",
}: CollaboratorsBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const members = useProjectMembers();
  const activeCollaborators = useActiveCollaborators();
  const myRole = useMyRole();

  const canInvite = myRole === "owner" || myRole === "editor";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  // Get online members for avatar display
  const activeIds = new Set(activeCollaborators.map((c) => c.id));
  const onlineMembers = members.filter((m) => activeIds.has(m.userId));
  const displayMembers = onlineMembers.slice(0, maxAvatars);
  const overflowCount = Math.max(0, onlineMembers.length - maxAvatars);

  const handleInviteClick = () => {
    setIsOpen(false);
    onInviteClick?.();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Collaborators Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-mythos-bg-primary transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar Stack */}
        <div className="flex -space-x-2">
          {displayMembers.length > 0 ? (
            displayMembers.map((member) => {
              const presence = activeCollaborators.find(
                (c) => c.id === member.userId
              );
              return (
                <Avatar
                  key={member.id}
                  name={member.name}
                  avatarUrl={member.avatarUrl}
                  color={presence?.color}
                  size="sm"
                />
              );
            })
          ) : (
            <div className="w-7 h-7 rounded-full bg-mythos-bg-primary border-2 border-mythos-text-muted/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-mythos-text-muted" />
            </div>
          )}
          {overflowCount > 0 && (
            <div className="w-7 h-7 rounded-full bg-mythos-bg-primary border-2 border-mythos-text-muted/30 flex items-center justify-center text-xs font-medium text-mythos-text-secondary">
              +{overflowCount}
            </div>
          )}
        </div>

        {/* Member Count */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-mythos-text-secondary">{members.length}</span>
          <ChevronDown
            className={`w-4 h-4 text-mythos-text-muted transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 z-50"
          role="menu"
        >
          <CollaboratorsDropdown
            members={members}
            activeCollaborators={activeCollaborators}
            onInviteClick={handleInviteClick}
            canInvite={canInvite}
          />
        </div>
      )}
    </div>
  );
}

export type { CollaboratorsBarProps };
