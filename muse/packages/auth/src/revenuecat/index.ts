/**
 * RevenueCat Integration
 *
 * Unified in-app purchases and subscriptions across:
 * - iOS (App Store)
 * - Android (Play Store)
 * - macOS (Mac App Store)
 *
 * @see https://www.revenuecat.com/docs
 */

import { getAuthConfig, getPlatform, isNativePlatform } from "../config";
import { useSubscriptionStore, useAuthStore } from "../store";
import type { Subscription } from "../types";

// RevenueCat SDK types (imported dynamically)
interface CustomerInfo {
  originalAppUserId: string;
  activeSubscriptions: string[];
  entitlements: {
    active: Record<
      string,
      {
        identifier: string;
        productIdentifier: string;
        isSandbox: boolean;
        willRenew: boolean;
        periodType: string;
        latestPurchaseDate: string;
        originalPurchaseDate: string;
        expirationDate: string | null;
        store: string;
      }
    >;
  };
}

// Dynamic import for RevenueCat SDK
let Purchases: any = null;

/**
 * Initialize RevenueCat SDK
 * Call this early in app startup
 */
export async function initRevenueCat(): Promise<void> {
  if (!isNativePlatform()) {
    console.log("[revenuecat] Skipping init on web platform");
    return;
  }

  const config = getAuthConfig();
  if (!config.revenueCatApiKey) {
    console.warn("[revenuecat] No API key configured");
    return;
  }

  try {
    // Dynamic import to avoid bundling on web
    const purchasesModule = await import("react-native-purchases");
    Purchases = purchasesModule.default;

    const platform = getPlatform();

    // Configure with platform-specific options
    await Purchases.configure({
      apiKey: config.revenueCatApiKey,
      appUserID: null, // Anonymous until login
    });

    console.log(`[revenuecat] Initialized for ${platform}`);
  } catch (error) {
    console.error("[revenuecat] Init failed:", error);
  }
}

/**
 * Login to RevenueCat with user ID
 * Call after auth login
 */
export async function loginRevenueCat(userId: string): Promise<CustomerInfo | null> {
  if (!Purchases) {
    console.warn("[revenuecat] SDK not initialized");
    return null;
  }

  try {
    const { customerInfo } = await Purchases.logIn(userId);
    await syncCustomerInfo(customerInfo);
    return customerInfo;
  } catch (error) {
    console.error("[revenuecat] Login failed:", error);
    return null;
  }
}

/**
 * Logout from RevenueCat
 * Call after auth logout
 */
export async function logoutRevenueCat(): Promise<void> {
  if (!Purchases) return;

  try {
    await Purchases.logOut();
    useSubscriptionStore.getState().reset();
  } catch (error) {
    console.error("[revenuecat] Logout failed:", error);
  }
}

/**
 * Sync customer info to subscription store
 */
export async function syncCustomerInfo(customerInfo: CustomerInfo): Promise<void> {
  const store = useSubscriptionStore.getState();
  const activeEntitlements = Object.keys(customerInfo.entitlements.active);

  if (activeEntitlements.length === 0) {
    store.setSubscription(null);
    return;
  }

  // Get the first active entitlement
  const firstKey = activeEntitlements[0];
  const entitlement = customerInfo.entitlements.active[firstKey];

  const subscription: Subscription = {
    id: customerInfo.originalAppUserId,
    userId: useAuthStore.getState().user?.id || "",
    status: "active",
    productId: entitlement.productIdentifier,
    entitlements: activeEntitlements,
    expiresAt: entitlement.expirationDate
      ? new Date(entitlement.expirationDate).getTime()
      : undefined,
    isTrialPeriod: entitlement.periodType === "trial",
    store: mapStore(entitlement.store),
  };

  store.setSubscription(subscription);
}

/**
 * Map RevenueCat store to our store type
 */
function mapStore(store: string): Subscription["store"] {
  switch (store.toUpperCase()) {
    case "APP_STORE":
      return "APP_STORE";
    case "MAC_APP_STORE":
      return "MAC_APP_STORE";
    case "PLAY_STORE":
      return "PLAY_STORE";
    case "STRIPE":
      return "STRIPE";
    default:
      return "APP_STORE";
  }
}

/**
 * Refresh customer info from RevenueCat
 */
export async function refreshCustomerInfo(): Promise<CustomerInfo | null> {
  if (!Purchases) return null;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    await syncCustomerInfo(customerInfo);
    return customerInfo;
  } catch (error) {
    console.error("[revenuecat] Refresh failed:", error);
    return null;
  }
}

/**
 * Get available packages/products
 */
export async function getOfferings() {
  if (!Purchases) return null;

  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.error("[revenuecat] Get offerings failed:", error);
    return null;
  }
}

/**
 * Purchase a package
 */
export async function purchasePackage(pkg: any): Promise<CustomerInfo | null> {
  if (!Purchases) return null;

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    await syncCustomerInfo(customerInfo);
    return customerInfo;
  } catch (error: any) {
    // Check for user cancellation
    if (error.userCancelled) {
      console.log("[revenuecat] Purchase cancelled by user");
      return null;
    }
    console.error("[revenuecat] Purchase failed:", error);
    throw error;
  }
}

/**
 * Restore purchases (for when user reinstalls app)
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!Purchases) return null;

  try {
    const customerInfo = await Purchases.restorePurchases();
    await syncCustomerInfo(customerInfo);
    return customerInfo;
  } catch (error) {
    console.error("[revenuecat] Restore failed:", error);
    return null;
  }
}

/**
 * Check if user has active subscription
 */
export function hasActiveSubscription(): boolean {
  return useSubscriptionStore.getState().subscription?.status === "active";
}

/**
 * Check if user has specific entitlement
 */
export function hasEntitlement(entitlement: string): boolean {
  return useSubscriptionStore.getState().entitlements.includes(entitlement);
}

/**
 * Hook: Sync RevenueCat with the auth user
 */
export function useRevenueCatSync() {
  const userId = useAuthStore((s) => s.user?.id);

  // This should be called in a useEffect in your app
  return {
    sync: async () => {
      if (userId) {
        await loginRevenueCat(userId);
      } else {
        await logoutRevenueCat();
      }
    },
    userId,
  };
}
