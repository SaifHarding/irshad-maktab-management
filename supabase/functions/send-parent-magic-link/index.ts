import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMagicLinkRequest {
  student_code: string;
  email_override?: string;
}

const generateEmailHtml = (studentName: string, magicLink: string, maktab: string) => {
  const maktabName = maktab === "boys" ? "Boys Maktab" : "Girls Maktab";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maktab Parent Portal Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Masjid Irshad</h1>
              <p style="color: #99f6e4; margin: 8px 0 0 0; font-size: 16px;">${maktabName} - Parent Portal</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <!-- Islamic Greeting -->
              <p style="font-size: 20px; color: #0f766e; margin: 0 0 8px 0; font-weight: 600; text-align: center;">
                Assalamu Alaikum Wa Rahmatullahi Wa Barakatuh
              </p>
              <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px 0; text-align: center; font-style: italic;">
                Peace, mercy, and blessings of Allah be upon you
              </p>
              
              <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0; line-height: 1.6;">
                Dear Parent/Guardian of <strong style="color: #0f766e;">${studentName}</strong>,
              </p>
              
              <p style="font-size: 16px; color: #374151; margin: 0 0 24px 0; line-height: 1.6;">
                You have been invited to access the <strong>Maktab Parent Portal</strong> - a dedicated platform to stay connected with your child's Islamic education journey.
              </p>
              
              <!-- Features Box -->
              <div style="background-color: #f0fdfa; border-radius: 8px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #0f766e;">
                <h3 style="color: #0f766e; margin: 0 0 16px 0; font-size: 16px;">With the Parent Portal, you can:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.8;">
                  <li><strong>View Attendance</strong> - Track your child's attendance history</li>
                  <li><strong>Monitor Progress</strong> - See Qaidah, Quran, Tajweed, and Hifz progress</li>
                  <li><strong>Receive Updates</strong> - Get important notifications from the Maktab</li>
                  <li><strong>Manage Profile</strong> - Update contact information</li>
                  <li><strong>View Billing</strong> - Access payment information (if applicable)</li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(15, 118, 110, 0.4);">
                      Access Parent Portal
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px 0; text-align: center;">
                This link will expire in 1 hour for security purposes.
              </p>
              
              <!-- Closing -->
              <p style="font-size: 16px; color: #374151; margin: 0 0 8px 0; line-height: 1.6;">
                May Allah bless your child's learning journey.
              </p>
              <p style="font-size: 16px; color: #0f766e; margin: 0; font-weight: 600;">
                JazakAllahu Khairan
              </p>
              <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0; font-style: italic;">
                May Allah reward you with goodness
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0 0 8px 0; text-align: center;">
                If you did not request this invitation, please ignore this email.
              </p>
              <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">
                Masjid Irshad Maktab • Attendance System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { student_code, email_override }: SendMagicLinkRequest = await req.json();

    if (!student_code) {
      return new Response(
        JSON.stringify({ error: "Student code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedCode = student_code.trim().toUpperCase();
    console.log(`Sending magic link for student code: ${normalizedCode}`);

    // Find the student by code
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, student_code, guardian_email, maktab, status")
      .eq("student_code", normalizedCode)
      .single();

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ error: "Invalid student code" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use email_override if provided, otherwise fall back to guardian_email
    const targetEmail = email_override?.trim() || student.guardian_email;

    if (!targetEmail) {
      return new Response(
        JSON.stringify({ error: "No email address provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = targetEmail.toLowerCase().trim();

    // Store pending link for later verification (delete any existing ones first)
    await supabase
      .from("pending_parent_links")
      .delete()
      .eq("email", email);

    const { error: pendingError } = await supabase
      .from("pending_parent_links")
      .insert({
        email: email,
        student_code: normalizedCode,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      });

    if (pendingError) {
      console.error("Error creating pending link:", pendingError);
      return new Response(
        JSON.stringify({ error: "Failed to create pending link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save the invite email and timestamp on the student record
    // Also update guardian_email if it was empty
    const updateData: Record<string, unknown> = {
      portal_invite_email: email,
      portal_invite_sent_at: new Date().toISOString(),
    };
    
    // If no guardian email exists, save the invite email as the guardian email
    if (!student.guardian_email) {
      updateData.guardian_email = email;
      console.log(`Setting guardian_email to ${email} for student ${student.id}`);
    }

    const { error: updateError } = await supabase
      .from("students")
      .update(updateData)
      .eq("id", student.id);

    if (updateError) {
      console.error("Error updating student invite record:", updateError);
      // Don't fail the request, just log the error
    }

    // Use the portal subdomain directly for callback
    const redirectUrl = "https://portal.masjidirshad.co.uk/portal/callback";

    console.log(`Generating magic link for ${email} with redirect to ${redirectUrl}`);

    // Generate the magic link using admin API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Error generating magic link:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate magic link. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const magicLink = linkData.properties.action_link;
    console.log(`Magic link generated successfully for ${email}`);

    // Send custom email via Resend if API key is available
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      
      const emailHtml = generateEmailHtml(student.name, magicLink, student.maktab);
      
      const { error: emailError } = await resend.emails.send({
        from: "Masjid Irshad Maktab <noreply@masjidirshad.co.uk>",
        to: [email],
        subject: `Parent Portal Invitation - ${student.name}`,
        html: emailHtml,
      });

      if (emailError) {
        console.error("Error sending email via Resend:", emailError);
        return new Response(
          JSON.stringify({ error: "Failed to send invitation email. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Custom invitation email sent successfully to ${email}`);
    } else {
      // Fallback to Supabase OTP if Resend is not configured
      console.log("RESEND_API_KEY not configured, falling back to Supabase OTP");
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (authError) {
        console.error("Error sending magic link:", authError);
        return new Response(
          JSON.stringify({ error: "Failed to send magic link. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation sent successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-parent-magic-link:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
