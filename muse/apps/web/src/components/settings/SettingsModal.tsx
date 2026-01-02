import { useState, useCallback, useEffect } from "react";
import {
  X,
  User,
  Mail,
  Camera,
  Check,
  AlertCircle,
  Loader2,
  LogOut,
  Sparkles,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { Button, Input, FormField, Select, ScrollArea, cn } from "@mythos/ui";
import { useAuthStore } from "../../stores/auth";
import { updateProfile, signOut } from "../../hooks/useSupabaseAuthSync";
import { useApiKey } from "../../hooks/useApiKey";
import type { NameCulture, NameStyle, LogicStrictness } from "@mythos/agent-protocol";

type SettingsSection = "profile" | "personalization" | "api";

const GENRE_OPTIONS = [
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

const CULTURE_OPTIONS = [
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

const NAME_STYLE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "short", label: "Short (1-2 syllables)" },
  { value: "long", label: "Long (3+ syllables)" },
];

const LOGIC_STRICTNESS_OPTIONS = [
  { value: "balanced", label: "Balanced" },
  { value: "lenient", label: "Lenient" },
  { value: "strict", label: "Strict" },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSection;
}

export function SettingsModal({ isOpen, onClose, initialSection = "profile" }: SettingsModalProps) {
  const user = useAuthStore((state) => state.user);
  const updateUserProfile = useAuthStore((state) => state.updateUserProfile);
  const { key, saveKey, clearKey, hasKey } = useApiKey();

  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

  const [name, setName] = useState(user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
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

  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [apiKeyInput, setApiKeyInput] = useState(key);
  const [showKey, setShowKey] = useState(false);
  const [isKeySaved, setIsKeySaved] = useState(false);

  const resetFormState = useCallback(() => {
    if (user) {
      setName(user.name || "");
      setAvatarUrl(user.avatarUrl || "");
      setPreferredGenre(user.preferences?.writing?.preferredGenre || "");
      setNamingCulture(user.preferences?.writing?.namingCulture || "");
      setNamingStyle(user.preferences?.writing?.namingStyle || "standard");
      setLogicStrictness(user.preferences?.writing?.logicStrictness || "balanced");
    }
    setApiKeyInput(key);
    setShowKey(false);
    setError(null);
    setSuccessMessage(null);
    setIsKeySaved(false);
  }, [user, key]);

  useEffect(() => {
    if (!isOpen) return;
    resetFormState();
    setActiveSection(initialSection);
  }, [isOpen, resetFormState, initialSection]);

  const handleSaveProfile = useCallback(async () => {
    if (!user) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

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
      updateUserProfile({
        name: name.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        preferences: nextPreferences,
      });

      const { error: updateError } = await updateProfile(user.id, {
        name: name.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        preferences: nextPreferences,
      });

      if (updateError) {
        setError(updateError.message);
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
  }, [
    user,
    name,
    avatarUrl,
    preferredGenre,
    namingCulture,
    namingStyle,
    logicStrictness,
    updateUserProfile,
  ]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setError(null);
    try {
      const { error: signOutError } = await signOut();
      if (signOutError) {
        setError(signOutError.message);
        setIsSigningOut(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
      setIsSigningOut(false);
    }
  }, []);

  const handleSaveApiKey = useCallback(() => {
    if (apiKeyInput.trim()) {
      saveKey(apiKeyInput.trim());
      setIsKeySaved(true);
      setTimeout(() => setIsKeySaved(false), 2000);
    }
  }, [apiKeyInput, saveKey]);

  const handleClearApiKey = useCallback(() => {
    clearKey();
    setApiKeyInput("");
    setShowKey(false);
  }, [clearKey]);

  const handleClose = useCallback(() => {
    resetFormState();
    onClose();
  }, [resetFormState, onClose]);

  const hasProfileChanges = user && (
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
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative z-10 w-[min(980px,92vw)] h-[min(80vh,760px)] rounded-2xl border border-mythos-border-default bg-mythos-bg-secondary shadow-2xl overflow-hidden">
        <div className="absolute right-4 top-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex h-full">
          <aside className="w-60 border-r border-mythos-border-default bg-mythos-bg-tertiary/30 p-4">
            <div className="text-xs uppercase tracking-wide text-mythos-text-muted mb-2">
              Account
            </div>
            <button
              type="button"
              onClick={() => setActiveSection("profile")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                activeSection === "profile"
                  ? "bg-mythos-bg-secondary text-mythos-text-primary"
                  : "text-mythos-text-secondary hover:bg-mythos-bg-secondary/60"
              )}
            >
              <User className="w-4 h-4" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("personalization")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                activeSection === "personalization"
                  ? "bg-mythos-bg-secondary text-mythos-text-primary"
                  : "text-mythos-text-secondary hover:bg-mythos-bg-secondary/60"
              )}
            >
              <Sparkles className="w-4 h-4" />
              Personalization
            </button>

            <div className="text-xs uppercase tracking-wide text-mythos-text-muted mt-6 mb-2">
              API
            </div>
            <button
              type="button"
              onClick={() => setActiveSection("api")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                activeSection === "api"
                  ? "bg-mythos-bg-secondary text-mythos-text-primary"
                  : "text-mythos-text-secondary hover:bg-mythos-bg-secondary/60"
              )}
            >
              <Key className="w-4 h-4" />
              OpenRouter
            </button>
          </aside>

          <div className="flex-1 flex flex-col">
            <header className="px-6 py-4 border-b border-mythos-border-default">
              <div className="text-lg font-semibold text-mythos-text-primary">
                {activeSection === "profile"
                  ? "Account Settings"
                  : activeSection === "personalization"
                    ? "Personalization"
                    : "OpenRouter Configuration"}
              </div>
              <div className="text-xs text-mythos-text-muted">
                {activeSection === "profile"
                  ? "Manage your profile and security."
                  : activeSection === "personalization"
                    ? "Shape your writing style and AI behavior."
                    : "Use your OpenRouter key to access models."}
              </div>
            </header>

            <ScrollArea className="flex-1 px-6 py-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-mythos-accent-red/10 border border-mythos-accent-red/30 text-mythos-accent-red text-sm mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-mythos-accent-green/10 border border-mythos-accent-green/30 text-mythos-accent-green text-sm mb-4">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {activeSection === "profile" && (
                <div className="space-y-6">
                  <section className="space-y-4">
                    <div className="text-sm font-medium text-mythos-text-primary">
                      Profile
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={name || "User avatar"}
                            className="w-16 h-16 rounded-full object-cover border border-mythos-border-default"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-mythos-bg-tertiary border border-mythos-border-default flex items-center justify-center">
                            <User className="w-8 h-8 text-mythos-text-muted" />
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-mythos-bg-secondary border border-mythos-border-default">
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

                    <div className="flex justify-end">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={!hasProfileChanges || isSaving}
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
                  </section>

                  <section className="pt-6 border-t border-mythos-border-default">
                    <div className="text-sm font-medium text-mythos-text-primary mb-3">
                      Sign out
                    </div>
                    <Button
                      variant="destructive"
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="gap-2"
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
                  </section>
                </div>
              )}

              {activeSection === "personalization" && (
                <div className="space-y-6">
                  <section className="space-y-4">
                    <div className="text-sm font-medium text-mythos-text-primary">
                      Writing preferences
                    </div>
                    <p className="text-xs text-mythos-text-muted">
                      These preferences influence AI suggestions and name generation.
                    </p>

                    <FormField label="Preferred Genre" className="space-y-2">
                      <Select
                        options={GENRE_OPTIONS}
                        value={preferredGenre}
                        onChange={setPreferredGenre}
                        disabled={isSaving}
                      />
                    </FormField>

                    <FormField label="Naming Culture" className="space-y-2">
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

                    <FormField label="Name Style" className="space-y-2">
                      <Select
                        options={NAME_STYLE_OPTIONS}
                        value={namingStyle}
                        onChange={(v) => setNamingStyle(v as NameStyle)}
                        disabled={isSaving}
                      />
                    </FormField>

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

                    <div className="flex justify-end">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={!hasProfileChanges || isSaving}
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
                            Save Preferences
                          </>
                        )}
                      </Button>
                    </div>
                  </section>
                </div>
              )}

              {activeSection === "api" && (
                <div className="space-y-6">
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-mythos-text-primary">
                          OpenRouter API Key
                        </div>
                        <p className="text-xs text-mythos-text-muted">
                          Use your OpenRouter key to access models in Mythos.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {hasKey ? (
                          <>
                            <Check className="w-4 h-4 text-mythos-accent-green" />
                            <span className="text-mythos-accent-green">Connected</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-mythos-accent-yellow" />
                            <span className="text-mythos-accent-yellow">Not connected</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-mythos-border-default bg-mythos-bg-tertiary/40 p-4 space-y-4">
                      <FormField label="OpenRouter API Key" className="space-y-2">
                        <div className="relative">
                          <Input
                            type={showKey ? "text" : "password"}
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder="sk-or-v1-..."
                            className="pr-10 font-mono text-sm"
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-mythos-text-muted hover:text-mythos-text-primary"
                          >
                            {showKey ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </FormField>

                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          onClick={handleSaveApiKey}
                          disabled={!apiKeyInput.trim() || apiKeyInput === key}
                          className="gap-1.5"
                        >
                          {isKeySaved ? (
                            <>
                              <Check className="w-4 h-4" />
                              Saved
                            </>
                          ) : (
                            "Change Key & Refresh"
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleClearApiKey}
                          disabled={!hasKey}
                          className="gap-1.5"
                        >
                          Delete Key
                        </Button>
                      </div>
                    </div>

                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-mythos-accent-primary hover:underline"
                    >
                      Get an API key from OpenRouter
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </section>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
