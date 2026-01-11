import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customer_id, maktab, return_url } = await req.json();

    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: "Customer ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which Stripe key to use based on maktab
    const girlsKey = Deno.env.get("STRIPE_SECRET_KEY_GIRLS");
    const boysKey = Deno.env.get("STRIPE_SECRET_KEY_BOYS");

    console.log("Stripe secret presence", {
      maktab,
      hasGirlsKey: Boolean(girlsKey),
      hasBoysKey: Boolean(boysKey),
    });

    const primaryKey = maktab === "girls" ? girlsKey : boysKey;
    const fallbackKey = maktab === "girls" ? boysKey : girlsKey;

    if (!primaryKey) {
      console.error(`Stripe key not configured for maktab: ${maktab}`);
      return new Response(
        JSON.stringify({
          error: "Payment system not configured",
          missing: maktab === "girls" ? "STRIPE_SECRET_KEY_GIRLS" : "STRIPE_SECRET_KEY_BOYS",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const createPortalSession = async (stripeKey: string) => {
      const stripe = new Stripe(stripeKey, {
        apiVersion: "2023-10-16",
      });

      return await stripe.billingPortal.sessions.create({
        customer: customer_id,
        return_url: return_url || "https://portal.masjidirshad.co.uk/billing",
      });
    };

    // Create a billing portal session (with cross-account fallback)
    try {
      const session = await createPortalSession(primaryKey);
      return new Response(
        JSON.stringify({ url: session.url, used_maktab: maktab }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      // If the customer doesn't exist in the expected Stripe account, try the other account.
      // This can happen if a customer ID was manually entered or created under the other maktab.
      const isMissingCustomer = typeof message === "string" && message.includes("No such customer");

      if (isMissingCustomer && fallbackKey) {
        console.warn("Customer not found in primary account; retrying with fallback account", {
          customer_id,
          requested_maktab: maktab,
        });

        const fallbackMaktab = maktab === "girls" ? "boys" : "girls";
        const session = await createPortalSession(fallbackKey);

        return new Response(
          JSON.stringify({ url: session.url, used_maktab: fallbackMaktab, fallback_used: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw err;
    }
  } catch (error) {
    console.error("Error creating portal session:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
