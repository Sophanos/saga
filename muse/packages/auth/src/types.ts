/**
 * Authentication Types
 */

import type { ProfilePreferences } from "@mythos/agent-protocol";

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  avatarUrl?: string;
  preferences?: ProfilePreferences;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  token: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface Subscription {
  id: string;
  userId: string;
  status: SubscriptionStatus;
  productId: string;
  entitlements: string[];
  expiresAt?: number;
  isTrialPeriod: boolean;
  store: SubscriptionStore;
}

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired"
  | "paused"
  | "grace_period";

export type SubscriptionStore =
  | "APP_STORE"
  | "MAC_APP_STORE"
  | "PLAY_STORE"
  | "STRIPE"
  | "PROMOTIONAL";

export interface SubscriptionState {
  subscription: Subscription | null;
  isLoading: boolean;
  entitlements: string[];
  hasProAccess: boolean;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  name?: string;
}

export type SocialProvider = "apple" | "google";
