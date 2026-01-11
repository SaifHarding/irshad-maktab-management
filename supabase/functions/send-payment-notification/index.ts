import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface PaymentNotificationRequest {
  studentName: string;
  guardianEmail: string;
  maktab: "boys" | "girls";
  paymentType?: "checkout_completed" | "subscription_paid";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { studentName, guardianEmail, maktab, paymentType = "checkout_completed" }: PaymentNotificationRequest = await req.json();

    console.log(`Sending payment notification for ${studentName} in ${maktab} maktab`);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get head teachers for this maktab
    const { data: headTeachers, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("maktab", maktab)
      .eq("is_head_teacher", true);

    if (error) {
      console.error("Error fetching head teachers:", error);
      return new Response(JSON.stringify({ error: "Failed to find head teachers" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!headTeachers || headTeachers.length === 0) {
      console.log("No head teachers found for maktab:", maktab);
      return new Response(JSON.stringify({ message: "No head teachers to notify" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maktabLabel = maktab === "boys" ? "Boys Maktab" : "Girls Maktab";
    
    // Get head teacher emails from their profiles
    const headTeacherEmails = headTeachers
      .map(ht => ht.email)
      .filter((email): email is string => !!email);

    if (headTeacherEmails.length === 0) {
      console.log("No head teacher emails configured for maktab:", maktab);
      // Still create in-app notifications even if no email
    } else {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Masjid Irshad Maktab <noreply@masjidirshad.co.uk>",
          to: headTeacherEmails,
          subject: `Payment Received - ${studentName} - ${maktabLabel}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">Payment Received ✓</h2>
              
              <p>Assalamu Alaikum,</p>
              
              <p>A payment has been successfully processed for:</p>
              
              <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Student:</strong> ${studentName}</p>
                <p style="margin: 8px 0 0;"><strong>Guardian Email:</strong> ${guardianEmail}</p>
                <p style="margin: 8px 0 0;"><strong>Maktab:</strong> ${maktabLabel}</p>
                <p style="margin: 8px 0 0;"><strong>Payment Type:</strong> ${paymentType === "checkout_completed" ? "Initial Registration (Admission + Subscription)" : "Subscription Payment"}</p>
              </div>
              
              <p>The student has been automatically marked as <strong style="color: #16a34a;">Active</strong> in the system and is now enrolled.</p>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                This is an automated notification from the Maktab management system.
              </p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const emailError = await emailRes.text();
        console.error("Failed to send notification email:", emailError);
      } else {
        console.log("Payment notification email sent to:", headTeacherEmails);
      }
    }

    // Also create in-app notifications for head teachers
    for (const teacher of headTeachers) {
      await supabase.from("parent_notifications").insert({
        parent_id: teacher.id,
        title: "Payment Received",
        message: `${studentName} (guardian: ${guardianEmail}) has completed payment and is now active in ${maktabLabel}.`,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending payment notification:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
