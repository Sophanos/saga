/**
 * Minimal Stripe API client for server-side HTTP actions.
 */

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export interface StripeCustomer {
  id: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
  customer: string | null;
}

export interface StripePortalSession {
  id: string;
  url: string;
}

export async function createStripeCustomer(params: {
  userId: string;
}): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>("/customers", {
    "metadata[userId]": params.userId,
  });
}

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: string;
  entitlement: string;
}): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": params.priceId,
    "line_items[0][quantity]": 1,
    customer: params.customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId,
    "metadata[userId]": params.userId,
    "metadata[entitlement]": params.entitlement,
    "subscription_data[metadata][userId]": params.userId,
    "subscription_data[metadata][entitlement]": params.entitlement,
  });
}

export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<StripePortalSession> {
  return stripeRequest<StripePortalSession>("/billing_portal/sessions", {
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

async function stripeRequest<T>(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>
): Promise<T> {
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    body.append(key, String(value));
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe API error: ${response.status} - ${errorText}`);
  }

  return (await response.json()) as T;
}
