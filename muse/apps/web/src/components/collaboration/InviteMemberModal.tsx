import { useState, useCallback, useEffect } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { X, UserPlus, Mail, Trash2, Clock, Send } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  FormField,
  Select,
  ScrollArea,
  toast,
} from "@mythos/ui";
import { useCurrentProject } from "../../stores";
type InviteRole = "editor" | "viewer";
import { isValidEmail } from "@mythos/core";
import { useAuthStore } from "../../stores/auth";

// ============================================================================
// Types
// ============================================================================

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvited?: () => void;
}

interface InviteFormData {
  email: string;
  role: InviteRole;
}

// ============================================================================
// Constants
// ============================================================================

const ROLE_OPTIONS: { value: InviteRole; label: string }[] = [
  { value: "editor", label: "Editor - Can edit content" },
  { value: "viewer", label: "Viewer - Read-only access" },
];

// ============================================================================
// Pending Invitation Item
// ============================================================================

interface ProjectInvitationWithInviter {
  id: string;
  email: string;
  role: InviteRole;
  expiresAt: string;
}

interface PendingInvitationItemProps {
  invitation: ProjectInvitationWithInviter;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function PendingInvitationItem({
  invitation,
  onDelete,
  isDeleting,
}: PendingInvitationItemProps) {
  const roleLabels: Record<string, string> = {
    owner: "Owner",
    editor: "Editor",
    viewer: "Viewer",
  };

  const expiresAt = new Date(invitation.expiresAt);
  const isExpired = expiresAt < new Date();
  const daysUntilExpiry = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-mythos-bg-primary/50 rounded-md group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-mythos-accent-primary/20 flex items-center justify-center">
          <Mail className="w-4 h-4 text-mythos-accent-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-mythos-text-primary truncate">
            {invitation.email}
          </p>
          <div className="flex items-center gap-2 text-xs text-mythos-text-muted">
            <span>{roleLabels[invitation.role]}</span>
            <span>-</span>
            {isExpired ? (
              <span className="text-mythos-accent-red">Expired</span>
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""} left
              </span>
            )}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(invitation.id)}
        disabled={isDeleting}
        className="h-8 w-8 text-mythos-text-muted hover:text-mythos-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
        title="Cancel invitation"
      >
        {isDeleting ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

const initialFormData: InviteFormData = {
  email: "",
  role: "editor",
};

export function InviteMemberModal({
  isOpen,
  onClose,
  onInvited,
}: InviteMemberModalProps) {
  const project = useCurrentProject();
  const currentUser = useAuthStore((s) => s.user);
  const convex = useConvex();
  const createInvitation = useMutation(api.collaboration.createInvitation);
  const revokeInvitation = useMutation(api.collaboration.revokeInvitation);

  const [formData, setFormData] = useState<InviteFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pendingInvitations, setPendingInvitations] = useState<
    ProjectInvitationWithInviter[]
  >([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load pending invitations when modal opens
  useEffect(() => {
    if (isOpen && project?.id) {
      loadPendingInvitations();
    }
  }, [isOpen, project?.id]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(initialFormData);
      setErrors({});
    }
  }, [isOpen]);

  const loadPendingInvitations = useCallback(async () => {
    if (!project?.id) return;

    setIsLoadingInvitations(true);
    try {
      const invitations = await convex.query(api.collaboration.listProjectInvitationsWithInviter, {
        projectId: project.id as Id<"projects">,
      });
      const mapped = (invitations ?? []).map(
        (invitation: { _id: string; email: string; role: string; expiresAt: number }) => ({
          id: invitation._id,
          email: invitation.email,
          role: invitation.role as InviteRole,
          expiresAt: new Date(invitation.expiresAt).toISOString(),
        })
      );
      setPendingInvitations(mapped);
    } catch (error) {
      console.error("[Collaboration] Failed to load invitations:", error);
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [convex, project?.id]);

  const updateFormData = useCallback((updates: Partial<InviteFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const fieldNames = Object.keys(updates);
    setErrors((prev) => {
      const next = { ...prev };
      fieldNames.forEach((f) => delete next[f]);
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors["email"] = "Email address is required";
    } else if (!isValidEmail(formData.email)) {
      newErrors["email"] = "Please enter a valid email address";
    }

    // Check if email already has pending invitation
    const existingInvitation = pendingInvitations.find(
      (inv) => inv.email.toLowerCase() === formData.email.trim().toLowerCase()
    );
    if (existingInvitation) {
      newErrors["email"] = "An invitation has already been sent to this email";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, pendingInvitations]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate() || isSubmitting || !project?.id || !currentUser?.id) return;

      setIsSubmitting(true);

      try {
        await createInvitation({
          projectId: project.id as Id<"projects">,
          email: formData.email.trim().toLowerCase(),
          role: formData.role,
          invitedBy: currentUser.id,
        });

        toast.success(`Invitation sent to ${formData.email}`);
        setFormData(initialFormData);
        await loadPendingInvitations();
        onInvited?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to send invitation");
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, validate, isSubmitting, project?.id, currentUser?.id, loadPendingInvitations, onInvited, createInvitation]
  );

  const handleDeleteInvitation = useCallback(
    async (invitationId: string) => {
      setDeletingId(invitationId);
      try {
        await revokeInvitation({
          invitationId: invitationId as Id<"projectInvitations">,
        });
        setPendingInvitations((prev) =>
          prev.filter((inv) => inv.id !== invitationId)
        );
        toast.success("Invitation cancelled");
      } catch (error) {
        toast.error("Failed to cancel invitation");
      } finally {
        setDeletingId(null);
      }
    },
    [revokeInvitation]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    },
    [onClose, isSubmitting]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-member-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 shadow-xl border-mythos-text-muted/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-mythos-accent-primary" />
              <CardTitle id="invite-member-title" className="text-lg">
                Invite Team Member
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="pt-1">
            Invite collaborators to work on "{project?.name}" with you.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pb-4">
            {/* Email Input */}
            <FormField label="Email Address" required error={errors["email"]}>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData({ email: e.target.value })}
                placeholder="colleague@example.com"
                autoFocus
                disabled={isSubmitting}
              />
            </FormField>

            {/* Role Selector */}
            <FormField label="Role">
              <Select
                value={formData.role}
                onChange={(v) => updateFormData({ role: v as InviteRole })}
                options={ROLE_OPTIONS}
                disabled={isSubmitting}
              />
            </FormField>

            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <div className="pt-2">
                <h4 className="text-sm font-medium text-mythos-text-secondary mb-2">
                  Pending Invitations ({pendingInvitations.length})
                </h4>
                <ScrollArea className="max-h-40">
                  <div className="space-y-2">
                    {pendingInvitations.map((invitation) => (
                      <PendingInvitationItem
                        key={invitation.id}
                        invitation={invitation}
                        onDelete={handleDeleteInvitation}
                        isDeleting={deletingId === invitation.id}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {isLoadingInvitations && pendingInvitations.length === 0 && (
              <div className="flex items-center justify-center py-4 text-mythos-text-muted">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                <span className="text-sm">Loading invitations...</span>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between gap-2 pt-4 border-t border-mythos-border-default">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.email.trim()}
              className="gap-1.5 min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export type { InviteMemberModalProps };
