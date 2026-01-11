import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const maktab = url.searchParams.get("maktab");

    if (!maktab || (maktab !== "boys" && maktab !== "girls")) {
      console.error("Invalid or missing maktab parameter:", maktab);
      return new Response(JSON.stringify({ error: "Invalid maktab parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing webhook for maktab: ${maktab}`);

    // Get the appropriate secrets based on maktab
    const stripeSecretKey = maktab === "boys" 
      ? Deno.env.get("STRIPE_SECRET_KEY_BOYS")
      : Deno.env.get("STRIPE_SECRET_KEY_GIRLS");
    
    const webhookSecret = maktab === "boys"
      ? Deno.env.get("STRIPE_WEBHOOK_SECRET_BOYS")
      : Deno.env.get("STRIPE_WEBHOOK_SECRET_GIRLS");

    if (!stripeSecretKey || !webhookSecret) {
      console.error(`Missing Stripe configuration for ${maktab}`);
      return new Response(JSON.stringify({ error: "Missing Stripe configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", errorMessage);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Received event: ${event.type}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout session completed:", session.id);
        
        const customerId = session.customer as string;
        const customerEmail = session.customer_email || session.customer_details?.email;
        
        console.log(`Customer ID: ${customerId}, Email: ${customerEmail}`);

        // Find the student by stripe_customer_id or guardian_email
        let studentQuery = supabase
          .from("students")
          .select("id, name, guardian_email, guardian_name, student_code, status, maktab")
          .eq("maktab", maktab);

        if (customerId) {
          studentQuery = studentQuery.eq("stripe_customer_id", customerId);
        }

        const { data: students, error: studentError } = await studentQuery;

        if (studentError) {
          console.error("Error finding student:", studentError);
          break;
        }

        let student = students?.[0];

        // If no student found by customer_id, try finding by email
        if (!student && customerEmail) {
          const { data: studentsByEmail, error: emailError } = await supabase
            .from("students")
            .select("id, name, guardian_email, guardian_name, student_code, status, maktab")
            .eq("maktab", maktab)
            .eq("guardian_email", customerEmail.toLowerCase());

          if (emailError) {
            console.error("Error finding student by email:", emailError);
            break;
          }

          student = studentsByEmail?.[0];

          // Update stripe_customer_id if found
          if (student && customerId) {
            await supabase
              .from("students")
              .update({ stripe_customer_id: customerId })
              .eq("id", student.id);
            console.log(`Updated stripe_customer_id for student ${student.id}`);
          }
        }

        if (!student) {
          console.log("No matching student found for this payment");
          break;
        }

        console.log(`Found student: ${student.name} (${student.id})`);

        // Update student status to active
        if (student.status !== "active") {
          const { error: updateError } = await supabase
            .from("students")
            .update({ status: "active" })
            .eq("id", student.id);

          if (updateError) {
            console.error("Error updating student status:", updateError);
          } else {
            console.log(`Student ${student.name} status updated to active`);

            // Send payment notification email to head teacher
            try {
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-payment-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  studentName: student.name,
                  guardianEmail: student.guardian_email,
                  maktab: maktab,
                  paymentType: "checkout_completed",
                }),
              });
            } catch (notifyErr) {
              console.error("Error sending payment notification:", notifyErr);
            }

            // Send confirmation email to parent
            try {
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-payment-confirmation`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  guardianEmail: student.guardian_email,
                  guardianName: student.guardian_name || "Parent/Guardian",
                  studentName: student.name,
                  studentCode: student.student_code || "N/A",
                  maktab: maktab,
                }),
              });
              console.log(`Payment confirmation email sent to ${student.guardian_email}`);
            } catch (confirmErr) {
              console.error("Error sending payment confirmation:", confirmErr);
            }
          }
        }

        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Invoice paid:", invoice.id);
        
        const customerId = invoice.customer as string;
        
        // Find and update student
        const { data: student, error } = await supabase
          .from("students")
          .select("id, name, status")
          .eq("stripe_customer_id", customerId)
          .eq("maktab", maktab)
          .single();

        if (error) {
          console.log("No student found for invoice:", customerId);
          break;
        }

        // Ensure student remains active on successful payment
        if (student.status !== "active") {
          await supabase
            .from("students")
            .update({ status: "active" })
            .eq("id", student.id);
          console.log(`Student ${student.name} reactivated after payment`);
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription updated:", subscription.id, "Status:", subscription.status);
        
        const customerId = subscription.customer as string;

        // Find student
        const { data: student, error } = await supabase
          .from("students")
          .select("id, name, status")
          .eq("stripe_customer_id", customerId)
          .eq("maktab", maktab)
          .single();

        if (error) {
          console.log("No student found for subscription:", customerId);
          break;
        }

        // Handle subscription cancellation or past_due
        if (subscription.status === "canceled" || subscription.status === "past_due") {
          console.log(`Subscription ${subscription.status} for student ${student.name}`);
          // You might want to mark student as inactive or send notifications
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
