import { useState, useCallback, useEffect } from "react";
import { X, Settings, Trash2, Crown, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Select,
  ScrollArea,
} from "@mythos/ui";
import {
  updateProjectMember,
  removeProjectMember,
  transferProjectOwnership,
} from "@mythos/db";
import {
  useProjectMembers,
  useMyRole,
  type ProjectMember,
  type ProjectRole,
} from "@mythos/state";
import { useCurrentProject } from "../../stores";
import { useAuthStore } from "../../stores/auth";

// ============================================================================
// Types
// ============================================================================

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMembersChanged?: () => void;
}

type FeedbackType = "success" | "error" | null;

interface Feedback {
  type: FeedbackType;
  message: string;
}

// ============================================================================
// Constants
// ============================================================================

const ROLE_OPTIONS: { value: ProjectRole; label: string }[] = [
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_BADGE_COLORS: Record<ProjectRole, string> = {
  owner: "bg-mythos-accent-yellow/20 text-mythos-accent-yellow",
  editor: "bg-mythos-accent-cyan/20 text-mythos-accent-cyan",
  viewer: "bg-mythos-text-muted/20 text-mythos-text-muted",
};

// ============================================================================
// Member Row Component
// ============================================================================

interface MemberRowProps {
  member: ProjectMember;
  canManage: boolean;
  isCurrentUser: boolean;
  isUpdating: boolean;
  isConfirmingRemove: boolean;
  onRoleChange: (newRole: ProjectRole) => void;
  onRemoveClick: () => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
}

function MemberRow({
  member,
  canManage,
  isCurrentUser,
  isUpdating,
  isConfirmingRemove,
  onRoleChange,
  onRemoveClick,
  onConfirmRemove,
  onCancelRemove,
}: MemberRowProps) {
  const isOwner = member.role === "owner";
  const canChangeRole = canManage && !isOwner;
  const canRemove = canManage && !isOwner && !isCurrentUser;

  const initials = member.name
    ? member.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-mythos-bg-primary/50 rounded-md transition-colors group">
      {/* Avatar */}
      {member.avatarUrl ? (
        <img
          src={member.avatarUrl}
          alt={member.name || "User avatar"}
          className="w-9 h-9 rounded-full object-cover border-2 border-mythos-bg-primary"
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-medium border-2 border-mythos-bg-primary text-sm"
          style={{ backgroundColor: "#6366F1", color: "#fff" }}
        >
          {initials}
        </div>
      )}

      {/* Name & Email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-mythos-text-primary truncate">
            {member.name || member.email}
          </span>
          {isCurrentUser && (
            <span className="text-xs text-mythos-text-muted">(you)</span>
          )}
          {isOwner && (
            <Crown className="w-3.5 h-3.5 text-mythos-accent-yellow" />
          )}
        </div>
        {member.name && member.email && (
          <span className="text-xs text-mythos-text-muted truncate block">
            {member.email}
          </span>
        )}
      </div>

      {/* Role Badge/Dropdown & Actions */}
      <div className="flex items-center gap-2">
        {canChangeRole ? (
          <Select
            value={member.role}
            onChange={(v) => onRoleChange(v as ProjectRole)}
            options={ROLE_OPTIONS}
            disabled={isUpdating}
            className="w-24 text-xs"
          />
        ) : (
          <span
            className={`text-xs px-2 py-1 rounded ${ROLE_BADGE_COLORS[member.role]}`}
          >
            {ROLE_LABELS[member.role]}
          </span>
        )}

        {/* Remove Button */}
        {canRemove && (
          isConfirmingRemove ? (
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                size="sm"
                onClick={onConfirmRemove}
                disabled={isUpdating}
                className="h-7 px-2 text-xs"
              >
                Remove
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelRemove}
                disabled={isUpdating}
                className="h-7 px-2 text-xs"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemoveClick}
              disabled={isUpdating}
              className="h-7 w-7 text-mythos-text-muted hover:text-mythos-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove member"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Ownership Transfer Section
// ============================================================================

interface OwnershipTransferSectionProps {
  members: ProjectMember[];
  currentUserId: string;
  onTransfer: (newOwnerId: string) => Promise<void>;
  isTransferring: boolean;
}

function OwnershipTransferSection({
  members,
  currentUserId,
  onTransfer,
  isTransferring,
}: OwnershipTransferSectionProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isConfirming, setIsConfirming] = useState(false);

  // Get eligible members (not current user, not already owner)
  const eligibleMembers = members.filter(
    (m) => m.userId !== currentUserId && m.role !== "owner"
  );

  if (eligibleMembers.length === 0) {
    return null;
  }

  const memberOptions = eligibleMembers.map((m) => ({
    value: m.userId,
    label: m.name || m.email,
  }));

  const handleTransfer = async () => {
    if (selectedUserId) {
      await onTransfer(selectedUserId);
      setSelectedUserId("");
      setIsConfirming(false);
    }
  };

  return (
    <div className="border-t border-mythos-text-muted/20 pt-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-mythos-accent-yellow" />
        <h4 className="text-sm font-medium text-mythos-accent-yellow">
          Transfer Ownership
        </h4>
      </div>
      <p className="text-xs text-mythos-text-muted mb-3">
        You will become an Editor. This action cannot be undone.
      </p>

      <div className="space-y-3">
        <Select
          value={selectedUserId}
          onChange={setSelectedUserId}
          options={[{ value: "", label: "Select new owner..." }, ...memberOptions]}
          disabled={isTransferring}
        />

        {selectedUserId && (
          isConfirming ? (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleTransfer}
                disabled={isTransferring}
                className="flex-1"
              >
                {isTransferring ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                    Transferring...
                  </>
                ) : (
                  "Yes, Transfer Ownership"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfirming(false)}
                disabled={isTransferring}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirming(true)}
              className="w-full"
            >
              Transfer Ownership
            </Button>
          )
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export function MemberManagementModal({
  isOpen,
  onClose,
  onMembersChanged,
}: MemberManagementModalProps) {
  const project = useCurrentProject();
  const members = useProjectMembers();
  const myRole = useMyRole();
  const currentUser = useAuthStore((s) => s.user);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const canManage = myRole === "owner";
  const currentUserId = currentUser?.id || "";

  // Sort members: owner first, then by name
  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === "owner") return -1;
    if (b.role === "owner") return 1;
    return (a.name || a.email).localeCompare(b.name || b.email);
  });

  // Clear feedback after 5 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      setConfirmingRemoveId(null);
      setUpdatingUserId(null);
    }
  }, [isOpen]);

  const handleRoleChange = useCallback(
    async (userId: string, newRole: ProjectRole) => {
      if (!project?.id) return;

      setUpdatingUserId(userId);
      setFeedback(null);

      try {
        await updateProjectMember(project.id, userId, { role: newRole });
        setFeedback({ type: "success", message: "Role updated" });
        onMembersChanged?.();
      } catch (error) {
        console.error("Failed to update role:", error);
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to update role",
        });
      } finally {
        setUpdatingUserId(null);
      }
    },
    [project?.id, onMembersChanged]
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!project?.id) return;

      setUpdatingUserId(userId);
      setFeedback(null);

      try {
        await removeProjectMember(project.id, userId);
        setFeedback({ type: "success", message: "Member removed" });
        setConfirmingRemoveId(null);
        onMembersChanged?.();
      } catch (error) {
        console.error("Failed to remove member:", error);
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to remove member",
        });
      } finally {
        setUpdatingUserId(null);
      }
    },
    [project?.id, onMembersChanged]
  );

  const handleTransferOwnership = useCallback(
    async (newOwnerId: string) => {
      if (!project?.id || !currentUserId) return;

      setIsTransferring(true);
      setFeedback(null);

      try {
        await transferProjectOwnership(project.id, currentUserId, newOwnerId);
        setFeedback({ type: "success", message: "Ownership transferred" });
        onMembersChanged?.();
      } catch (error) {
        console.error("Failed to transfer ownership:", error);
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to transfer ownership",
        });
      } finally {
        setIsTransferring(false);
      }
    },
    [project?.id, currentUserId, onMembersChanged]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !updatingUserId && !isTransferring) {
        onClose();
      }
    },
    [onClose, updatingUserId, isTransferring]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-team-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={updatingUserId || isTransferring ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 shadow-xl border-mythos-text-muted/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-mythos-accent-cyan" />
              <CardTitle id="manage-team-title" className="text-lg">
                Manage Team
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={!!updatingUserId || isTransferring}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="pt-1">
            Manage members and roles for "{project?.name}"
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pb-4">
          {/* Feedback Messages */}
          {feedback && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md ${
                feedback.type === "success"
                  ? "bg-mythos-accent-green/10 border border-mythos-accent-green/30"
                  : "bg-mythos-accent-red/10 border border-mythos-accent-red/30"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle className="w-4 h-4 text-mythos-accent-green flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-mythos-accent-red flex-shrink-0" />
              )}
              <p
                className={`text-sm ${
                  feedback.type === "success"
                    ? "text-mythos-accent-green"
                    : "text-mythos-accent-red"
                }`}
              >
                {feedback.message}
              </p>
            </div>
          )}

          {/* Member List */}
          <div>
            <h4 className="text-sm font-medium text-mythos-text-secondary mb-2">
              Members ({members.length})
            </h4>
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {sortedMembers.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    canManage={canManage}
                    isCurrentUser={member.userId === currentUserId}
                    isUpdating={updatingUserId === member.userId}
                    isConfirmingRemove={confirmingRemoveId === member.userId}
                    onRoleChange={(newRole) => handleRoleChange(member.userId, newRole)}
                    onRemoveClick={() => setConfirmingRemoveId(member.userId)}
                    onConfirmRemove={() => handleRemoveMember(member.userId)}
                    onCancelRemove={() => setConfirmingRemoveId(null)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Ownership Transfer (owner only) */}
          {canManage && (
            <OwnershipTransferSection
              members={members}
              currentUserId={currentUserId}
              onTransfer={handleTransferOwnership}
              isTransferring={isTransferring}
            />
          )}
        </CardContent>

        <CardFooter className="pt-4 border-t border-mythos-text-muted/20">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={!!updatingUserId || isTransferring}
            className="w-full"
          >
            Close
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export type { MemberManagementModalProps };
