import { useState, useRef, useEffect, useMemo, memo } from "react";
import { Users, ChevronDown, UserPlus, Settings } from "lucide-react";
import { Avatar, Button, ScrollArea } from "@mythos/ui";
import { MemberManagementModal } from "./MemberManagementModal";
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

// ============================================================================
// Member List Item
// ============================================================================

interface MemberListItemProps {
  member: ProjectMember;
  isOnline: boolean;
  presence?: CollaboratorPresence;
}

const MemberListItem = memo(function MemberListItem({ member, isOnline, presence }: MemberListItemProps) {
  const roleLabels: Record<string, string> = {
    owner: "Owner",
    editor: "Editor",
    viewer: "Viewer",
  };

  const roleBadgeColors: Record<string, string> = {
    owner: "bg-mythos-accent-yellow/20 text-mythos-accent-yellow",
    editor: "bg-mythos-accent-primary/20 text-mythos-accent-primary",
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
});

// ============================================================================
// Collaborators Dropdown
// ============================================================================

interface CollaboratorsDropdownProps {
  members: ProjectMember[];
  activeCollaborators: CollaboratorPresence[];
  onInviteClick?: () => void;
  onManageClick?: () => void;
  canInvite: boolean;
  canManage: boolean;
}

function CollaboratorsDropdown({
  members,
  activeCollaborators,
  onInviteClick,
  onManageClick,
  canInvite,
  canManage,
}: CollaboratorsDropdownProps) {
  const activeIds = useMemo(
    () => new Set(activeCollaborators.map((c) => c.id)),
    [activeCollaborators]
  );

  // Sort members: online first, then by name
  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const aOnline = activeIds.has(a.userId);
        const bOnline = activeIds.has(b.userId);
        if (aOnline !== bOnline) return bOnline ? 1 : -1;
        return (a.name || a.email).localeCompare(b.name || b.email);
      }),
    [members, activeIds]
  );

  const onlineCount = useMemo(
    () => members.filter((m) => activeIds.has(m.userId)).length,
    [members, activeIds]
  );

  return (
    <div className="w-72 bg-mythos-bg-secondary border border-mythos-border-default rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-mythos-border-default">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-mythos-text-primary">
              Team Members
            </h3>
            <p className="text-xs text-mythos-text-muted">
              {onlineCount} online, {members.length} total
            </p>
          </div>
          <div className="flex items-center gap-1">
            {canManage && onManageClick && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onManageClick}
                className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
                title="Manage team"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
            {canInvite && onInviteClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onInviteClick}
                className="gap-1 text-mythos-accent-primary hover:text-mythos-accent-primary/80"
              >
                <UserPlus className="w-4 h-4" />
                Invite
              </Button>
            )}
          </div>
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
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const members = useProjectMembers();
  const activeCollaborators = useActiveCollaborators();
  const myRole = useMyRole();

  const canInvite = myRole === "owner" || myRole === "editor";
  const canManage = myRole === "owner";

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
  const displayMembers = useMemo(() => {
    const activeIds = new Set(activeCollaborators.map((c) => c.id));
    const onlineMembers = members.filter((m) => activeIds.has(m.userId));
    return onlineMembers.slice(0, maxAvatars);
  }, [members, activeCollaborators, maxAvatars]);

  const overflowCount = useMemo(() => {
    const activeIds = new Set(activeCollaborators.map((c) => c.id));
    const onlineMembers = members.filter((m) => activeIds.has(m.userId));
    return Math.max(0, onlineMembers.length - maxAvatars);
  }, [members, activeCollaborators, maxAvatars]);

  const handleInviteClick = () => {
    setIsOpen(false);
    onInviteClick?.();
  };

  const handleManageClick = () => {
    setIsOpen(false);
    setIsManageModalOpen(true);
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
            onManageClick={handleManageClick}
            canInvite={canInvite}
            canManage={canManage}
          />
        </div>
      )}

      {/* Member Management Modal */}
      <MemberManagementModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
      />
    </div>
  );
}

export type { CollaboratorsBarProps };
