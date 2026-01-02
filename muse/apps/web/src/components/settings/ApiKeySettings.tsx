import { useState, useCallback } from "react";
import { X, Eye, EyeOff, ExternalLink, Key, Check, AlertCircle } from "lucide-react";
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, FormField } from "@mythos/ui";
import { useApiKey } from "../../hooks/useApiKey";

interface ApiKeySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeySettings({ isOpen, onClose }: ApiKeySettingsProps) {
  const { key, saveKey, clearKey, hasKey } = useApiKey();
  const [inputValue, setInputValue] = useState(key);
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = useCallback(() => {
    if (inputValue.trim()) {
      saveKey(inputValue.trim());
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  }, [inputValue, saveKey]);

  const handleClear = useCallback(() => {
    clearKey();
    setInputValue("");
    setShowKey(false);
  }, [clearKey]);

  const handleClose = useCallback(() => {
    setInputValue(key);
    setShowKey(false);
    onClose();
  }, [key, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 shadow-xl border-mythos-border-default">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-mythos-accent-primary" />
              <CardTitle className="text-lg">API Settings</CardTitle>
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
            Configure your OpenRouter API key for AI features.
            Your key is stored locally and never sent to our servers.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2 text-sm">
            {hasKey ? (
              <>
                <Check className="w-4 h-4 text-mythos-accent-green" />
                <span className="text-mythos-accent-green">API key configured</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-mythos-accent-yellow" />
                <span className="text-mythos-accent-yellow">No API key configured</span>
              </>
            )}
          </div>

          {/* API Key input */}
          <FormField label="OpenRouter API Key" className="space-y-2">
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
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

          {/* OpenRouter link */}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-mythos-accent-primary hover:underline"
          >
            Get an API key from OpenRouter
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </CardContent>

        <CardFooter className="flex justify-between gap-2 pt-2">
          <Button
            variant="destructive"
            onClick={handleClear}
            disabled={!hasKey}
            className="gap-1.5"
          >
            Clear Key
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!inputValue.trim() || inputValue === key}
              className="gap-1.5"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                "Save Key"
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
