import { Toaster as Sonner, toast as sonnerToast } from "sonner";

/**
 * Themed toast configuration for Mythos
 * Centralized toast styling with theme colors
 */
export const toastConfig = {
  position: "bottom-right" as const,
  duration: 4000,
  classNames: {
    toast:
      "bg-mythos-bg-secondary border border-mythos-border-default text-mythos-text-primary shadow-lg",
    title: "text-mythos-text-primary font-medium",
    description: "text-mythos-text-secondary text-sm",
    actionButton:
      "bg-mythos-accent-primary text-white hover:bg-mythos-accent-primary/90 text-xs font-medium px-3 py-1.5 rounded",
    cancelButton:
      "bg-mythos-bg-tertiary text-mythos-text-secondary hover:bg-mythos-bg-tertiary/80 text-xs font-medium px-3 py-1.5 rounded",
    success: "border-mythos-accent-green/30",
    error: "border-mythos-accent-red/30",
    warning: "border-mythos-accent-amber/30",
    info: "border-mythos-accent-primary/30",
  },
};

/**
 * Toast helper functions with consistent theming
 */
export const toast = {
  // Re-export base toast for custom use
  ...sonnerToast,

  // Success toast - green accent
  success: (message: string, options?: Parameters<typeof sonnerToast.success>[1]) =>
    sonnerToast.success(message, {
      className: toastConfig.classNames.success,
      ...options,
    }),

  // Error toast - red accent
  error: (message: string, options?: Parameters<typeof sonnerToast.error>[1]) =>
    sonnerToast.error(message, {
      className: toastConfig.classNames.error,
      ...options,
    }),

  // Warning toast - amber accent
  warning: (message: string, options?: Parameters<typeof sonnerToast.warning>[1]) =>
    sonnerToast.warning(message, {
      className: toastConfig.classNames.warning,
      ...options,
    }),

  // Info toast - blue accent
  info: (message: string, options?: Parameters<typeof sonnerToast.info>[1]) =>
    sonnerToast.info(message, {
      className: toastConfig.classNames.info,
      ...options,
    }),

  // Clipboard toast - common pattern
  copied: (what = "Copied to clipboard") =>
    sonnerToast.success(what, {
      className: toastConfig.classNames.success,
      duration: 2000,
    }),

  // Saved toast - common pattern
  saved: (what = "Saved") =>
    sonnerToast.success(what, {
      className: toastConfig.classNames.success,
      duration: 2000,
    }),

  // Deleted toast - common pattern
  deleted: (what: string) =>
    sonnerToast.success(`${what} deleted`, {
      className: toastConfig.classNames.success,
      duration: 3000,
    }),

  // Created toast - common pattern
  created: (what: string, options?: { action?: { label: string; onClick: () => void } }) =>
    sonnerToast.success(`${what} created`, {
      className: toastConfig.classNames.success,
      ...options,
    }),
};

export function Toaster() {
  return (
    <Sonner
      position={toastConfig.position}
      toastOptions={{
        duration: toastConfig.duration,
        classNames: {
          toast: toastConfig.classNames.toast,
          title: toastConfig.classNames.title,
          description: toastConfig.classNames.description,
          actionButton: toastConfig.classNames.actionButton,
          cancelButton: toastConfig.classNames.cancelButton,
        },
      }}
    />
  );
}
