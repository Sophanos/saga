/**
 * ProfileSettings Component
 * Profile management modal for viewing and editing user information
 */

import { useState, useCallback, useEffect } from "react";
import { X, User, Mail, Camera, Check, AlertCircle, Loader2, LogOut, Sparkles } from "lucide-react";
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, FormField, Select, type SelectOption } from "@mythos/ui";
import { useAuthStore } from "../../stores/auth";
import { updateProfile, signOut } from "../../hooks/useSupabaseAuthSync";
import type { NameCulture, NameStyle, LogicStrictness } from "@mythos/agent-protocol";

// Genre options
const GENRE_OPTIONS: SelectOption[] = [
  { value: "", label: "No preference" },
  { value: "fantasy", label: "Fantasy" },
  { value: "science_fiction", label: "Science Fiction" },
  { value: "horror", label: "Horror" },
  { value: "mystery", label: "Mystery" },
  { value: "romance", label: "Romance" },
  { value: "historical", label: "Historical" },
  { value: "literary", label: "Literary Fiction" },
  { value: "thriller", label: "Thriller" },
];

// Culture options for name generation
const CULTURE_OPTIONS: SelectOption[] = [
  { value: "", label: "Any/Mixed" },
  { value: "western", label: "Western" },
  { value: "norse", label: "Norse" },
  { value: "japanese", label: "Japanese" },
  { value: "chinese", label: "Chinese" },
  { value: "arabic", label: "Arabic" },
  { value: "slavic", label: "Slavic" },
  { value: "celtic", label: "Celtic" },
  { value: "latin", label: "Latin" },
  { value: "indian", label: "Indian" },
  { value: "african", label: "African" },
];

// Name style options
const NAME_STYLE_OPTIONS: SelectOption[] = [
  { value: "standard", label: "Standard" },
  { value: "short", label: "Short (1-2 syllables)" },
  { value: "long", label: "Long (3+ syllables)" },
];

// Logic strictness options
const LOGIC_STRICTNESS_OPTIONS: SelectOption[] = [
  { value: "balanced", label: "Balanced" },
  { value: "lenient", label: "Lenient" },
  { value: "strict", label: "Strict" },
];

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileSettings({ isOpen, onClose }: ProfileSettingsProps) {
  // Auth state
  const user = useAuthStore((state) => state.user);
  const updateUserProfile = useAuthStore((state) => state.updateUserProfile);

  // Form state
  const [name, setName] = useState(user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");

  // Writing preferences state
  const [preferredGenre, setPreferredGenre] = useState(
    user?.preferences?.writing?.preferredGenre || ""
  );
  const [namingCulture, setNamingCulture] = useState(
    user?.preferences?.writing?.namingCulture || ""
  );
  const [namingStyle, setNamingStyle] = useState(
    user?.preferences?.writing?.namingStyle || "standard"
  );
  const [logicStrictness, setLogicStrictness] = useState(
    user?.preferences?.writing?.logicStrictness || "balanced"
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset form when user changes or modal opens
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setAvatarUrl(user.avatarUrl || "");
      setPreferredGenre(user.preferences?.writing?.preferredGenre || "");
      setNamingCulture(user.preferences?.writing?.namingCulture || "");
      setNamingStyle(user.preferences?.writing?.namingStyle || "standard");
      setLogicStrictness(user.preferences?.writing?.logicStrictness || "balanced");
    }
    setError(null);
    setSuccessMessage(null);
  }, [user, isOpen]);

  const handleSave = useCallback(async () => {
    if (!user) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    // Build preferences object, merging with existing
    const nextPreferences = {
      ...(user.preferences ?? {}),
      writing: {
        ...(user.preferences?.writing ?? {}),
        preferredGenre: preferredGenre || undefined,
        namingCulture: (namingCulture as NameCulture) || undefined,
        namingStyle: (namingStyle as NameStyle) || undefined,
        logicStrictness: (logicStrictness as LogicStrictness) || undefined,
      },
    };

    try {
      // Optimistically update the local store
      updateUserProfile({
        name: name.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        preferences: nextPreferences,
      });

      // Save to database
      const { error: updateError } = await updateProfile(user.id, {
        name: name.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        preferences: nextPreferences,
      });

      if (updateError) {
        setError(updateError.message);
        // Revert optimistic update
        updateUserProfile({
          name: user.name,
          avatarUrl: user.avatarUrl,
          preferences: user.preferences,
        });
      } else {
        setSuccessMessage("Profile updated successfully");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }, [user, name, avatarUrl, preferredGenre, namingCulture, namingStyle, logicStrictness, updateUserProfile]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setError(null);

    try {
      const { error: signOutError } = await signOut();
      if (signOutError) {
        setError(signOutError.message);
        setIsSigningOut(false);
      }
      // If successful, the auth sync hook will handle the state update
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
      setIsSigningOut(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    // Reset form to original values
    if (user) {
      setName(user.name || "");
      setAvatarUrl(user.avatarUrl || "");
      setPreferredGenre(user.preferences?.writing?.preferredGenre || "");
      setNamingCulture(user.preferences?.writing?.namingCulture || "");
      setNamingStyle(user.preferences?.writing?.namingStyle || "standard");
      setLogicStrictness(user.preferences?.writing?.logicStrictness || "balanced");
    }
    setError(null);
    setSuccessMessage(null);
    onClose();
  }, [user, onClose]);

  const hasChanges = user && (
    name.trim() !== (user.name || "") ||
    avatarUrl.trim() !== (user.avatarUrl || "") ||
    preferredGenre !== (user.preferences?.writing?.preferredGenre || "") ||
    namingCulture !== (user.preferences?.writing?.namingCulture || "") ||
    namingStyle !== (user.preferences?.writing?.namingStyle || "standard") ||
    logicStrictness !== (user.preferences?.writing?.logicStrictness || "balanced")
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 shadow-xl border-mythos-text-muted/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-mythos-accent-cyan" />
              <CardTitle className="text-lg">Profile Settings</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="pt-1">
            Manage your account information and preferences.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-mythos-accent-red/10 border border-mythos-accent-red/30 text-mythos-accent-red text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-mythos-accent-green/10 border border-mythos-accent-green/30 text-mythos-accent-green text-sm">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name || "User avatar"}
                  className="w-16 h-16 rounded-full object-cover border-2 border-mythos-text-muted/20"
                  onError={(e) => {
                    // Hide broken images
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-mythos-bg-tertiary border-2 border-mythos-text-muted/20 flex items-center justify-center">
                  <User className="w-8 h-8 text-mythos-text-muted" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-mythos-bg-secondary border border-mythos-text-muted/20">
                <Camera className="w-3 h-3 text-mythos-text-muted" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-mythos-text-primary">
                {name || "Anonymous User"}
              </p>
              <p className="text-xs text-mythos-text-muted">{user?.email}</p>
            </div>
          </div>

          {/* Email (read-only) */}
          <FormField label="Email" className="space-y-2">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mythos-text-muted" />
              <Input
                type="email"
                value={user?.email || ""}
                className="pl-10 bg-mythos-bg-tertiary"
                disabled
              />
            </div>
            <p className="text-xs text-mythos-text-muted">
              Email cannot be changed. Contact support for assistance.
            </p>
          </FormField>

          {/* Name */}
          <FormField label="Display Name" className="space-y-2">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mythos-text-muted" />
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="pl-10"
                disabled={isSaving}
              />
            </div>
          </FormField>

          {/* Avatar URL */}
          <FormField label="Avatar URL" className="space-y-2">
            <div className="relative">
              <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mythos-text-muted" />
              <Input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="pl-10"
                disabled={isSaving}
              />
            </div>
            <p className="text-xs text-mythos-text-muted">
              Enter a URL to an image for your profile picture.
            </p>
          </FormField>

          {/* Writing Preferences Section */}
          <div className="pt-4 border-t border-mythos-text-muted/20">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-mythos-accent-purple" />
              <span className="text-sm font-medium text-mythos-text-primary">Writing Preferences</span>
            </div>
            <p className="text-xs text-mythos-text-muted mb-4">
              These preferences influence AI suggestions and name generation.
            </p>

            {/* Preferred Genre */}
            <FormField label="Preferred Genre" className="space-y-2 mb-4">
              <Select
                options={GENRE_OPTIONS}
                value={preferredGenre}
                onChange={setPreferredGenre}
                disabled={isSaving}
              />
            </FormField>

            {/* Naming Culture */}
            <FormField label="Naming Culture" className="space-y-2 mb-4">
              <Select
                options={CULTURE_OPTIONS}
                value={namingCulture}
                onChange={setNamingCulture}
                disabled={isSaving}
              />
              <p className="text-xs text-mythos-text-muted">
                Default cultural inspiration for generated names.
              </p>
            </FormField>

            {/* Naming Style */}
            <FormField label="Name Style" className="space-y-2 mb-4">
              <Select
                options={NAME_STYLE_OPTIONS}
                value={namingStyle}
                onChange={(v) => setNamingStyle(v as NameStyle)}
                disabled={isSaving}
              />
            </FormField>

            {/* Logic Strictness */}
            <FormField label="Logic Check Strictness" className="space-y-2">
              <Select
                options={LOGIC_STRICTNESS_OPTIONS}
                value={logicStrictness}
                onChange={(v) => setLogicStrictness(v as LogicStrictness)}
                disabled={isSaving}
              />
              <p className="text-xs text-mythos-text-muted">
                How strict the logic checker should be when validating rules.
              </p>
            </FormField>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-4">
          {/* Save/Cancel buttons */}
          <div className="flex justify-between w-full gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          {/* Sign out section */}
          <div className="w-full pt-3 border-t border-mythos-text-muted/20">
            <Button
              variant="destructive"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full gap-2"
            >
              {isSigningOut ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default ProfileSettings;
