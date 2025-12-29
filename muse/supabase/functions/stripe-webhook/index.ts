/**
 * Stripe Webhook Edge Function
 *
 * POST /stripe-webhook
 *
 * Handles Stripe webhook events for subscription management.
 * Verifies webhook signatures and updates the subscriptions table.
 *
 * Events handled:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 *
 * Environment Variables:
 * - STRIPE_SECRET_KEY: Stripe API secret key
 * - STRIPE_WEBHOOK_SECRET: Webhook endpoint signing secret
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin operations
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

// Initialize Stripe
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  throw new Error("Missing required Stripe environment variables");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;

/**
 * Subscription status mapping from Stripe to our database
 */
type SubscriptionStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "trialing"
  | "unpaid"
  | "paused";

/**
 * Get Supabase admin client for database operations
 */
function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Extract tier from Stripe price metadata or product
 */
function getTierFromPrice(price: Stripe.Price): string {
  // Check price metadata first
  if (price.metadata?.tier) {
    return price.metadata.tier;
  }

  // Fall back to product metadata if product is expanded
  const product = price.product;
  if (typeof product === "object" && product.metadata?.tier) {
    return product.metadata.tier;
  }

  // Default to 'pro' if no tier is specified
  return "pro";
}

/**
 * Extract billing interval from Stripe price
 * Note: This is different from billing_mode (managed vs byok)
 */
function getBillingInterval(price: Stripe.Price): "monthly" | "annual" {
  return price.recurring?.interval === "year" ? "annual" : "monthly";
}

/**
 * Update or create subscription in database
 */
async function upsertSubscription(
  subscription: Stripe.Subscription,
  customerId: string
) {
  const supabase = getSupabaseAdmin();

  // Get the user ID from the customer
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile) {
    // Log as warning - this is a business logic issue, not a system error
    // Returning without throwing allows the webhook to return 200 and prevent retries
    console.warn(`No profile found for customer: ${customerId}, event will not be retried`);
    return;
  }

  const userId = profile.id;

  // Get the first subscription item's price
  const subscriptionItem = subscription.items.data[0];
  const price = subscriptionItem?.price;

  const tier = price ? getTierFromPrice(price) : "free";
  const billingInterval = price ? getBillingInterval(price) : "monthly";

  const { error } = await supabase.from("subscriptions").upsert(
    {
      id: subscription.id,
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status as SubscriptionStatus,
      tier,
      // Stripe subscriptions are always 'managed' billing mode
      // BYOK users don't go through Stripe checkout
      billing_mode: "managed",
      // Store billing interval (monthly/annual) in metadata for reference
      metadata: {
        billing_interval: billingInterval,
      },
      current_period_start: new Date(
        subscription.current_period_start * 1000
      ).toISOString(),
      current_period_end: new Date(
        subscription.current_period_end * 1000
      ).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "stripe_subscription_id",
    }
  );

  if (error) {
    console.error("Error upserting subscription:", error);
    throw error;
  }

  console.log(`Subscription ${subscription.id} upserted for user ${userId}`);
}

/**
 * Handle checkout.session.completed event
 * Creates initial subscription record after successful checkout
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log(`Processing checkout session: ${session.id}`);

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    console.log("No subscription ID in checkout session, skipping");
    return;
  }

  // Retrieve the full subscription object
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price.product"],
  });

  await upsertSubscription(subscription, customerId);
}

/**
 * Handle subscription created/updated events
 */
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  console.log(
    `Processing subscription ${subscription.id}, status: ${subscription.status}`
  );

  const customerId = subscription.customer as string;

  // Retrieve with expanded price/product data
  const fullSubscription = await stripe.subscriptions.retrieve(
    subscription.id,
    {
      expand: ["items.data.price.product"],
    }
  );

  await upsertSubscription(fullSubscription, customerId);
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`Subscription deleted: ${subscription.id}`);

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Error updating deleted subscription:", error);
    throw error;
  }
}

/**
 * Handle invoice.paid event
 * Updates the subscription period after successful payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log(`Invoice paid: ${invoice.id}`);

  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    console.log("No subscription ID in invoice, skipping");
    return;
  }

  // Retrieve the updated subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price.product"],
  });

  const customerId = invoice.customer as string;
  await upsertSubscription(subscription, customerId);
}

/**
 * Handle invoice.payment_failed event
 * Updates subscription status to reflect payment failure
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`Payment failed for invoice: ${invoice.id}`);

  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    console.log("No subscription ID in invoice, skipping");
    return;
  }

  const supabase = getSupabaseAdmin();

  // The subscription status will be updated by Stripe's automatic handling
  // We just log this for monitoring purposes
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Error updating subscription on payment failure:", error);
    // Don't throw - this is informational
  }
}

/**
 * Verify Stripe webhook signature
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string
): Promise<Stripe.Event> {
  try {
    return await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      WEBHOOK_SECRET
    );
  } catch (err) {
    // Don't log the full error object which may contain sensitive data
    console.error("Webhook signature verification failed");
    throw new Error("Invalid webhook signature");
  }
}

serve(async (req) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Get the raw body and signature
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("No Stripe signature header");
      return new Response("No signature", { status: 400 });
    }

    // Verify the webhook signature
    const event = await verifyWebhookSignature(payload, signature);

    // Idempotency check - prevent duplicate processing of the same event
    // NOTE: Requires a 'stripe_events' table with columns: id (uuid), event_id (text unique), created_at (timestamptz)
    // CREATE TABLE stripe_events (
    //   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    //   event_id text UNIQUE NOT NULL,
    //   created_at timestamptz DEFAULT now()
    // );
    const supabaseAdmin = getSupabaseAdmin();
    const { data: existingEvent } = await supabaseAdmin
      .from('stripe_events')
      .select('id')
      .eq('event_id', event.id)
      .single();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Record event as being processed
    await supabaseAdmin.from('stripe_events').insert({
      event_id: event.id,
      event_type: event.type
    });

    console.log(`Received Stripe event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Check if this is a signature verification error (should return 400 to allow Stripe retry with correct signature)
    const isSignatureError = message === "Invalid webhook signature";

    // For business logic errors (not signature failures), return 200 to prevent retries
    // Stripe will retry 4xx errors, but business logic errors won't resolve on retry
    if (!isSignatureError) {
      return new Response(JSON.stringify({ received: true, error: message }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return 400 for signature errors - these may succeed on retry
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
