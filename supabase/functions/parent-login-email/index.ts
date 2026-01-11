import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LoginEmailRequest {
  email: string;
}

const generateLoginEmailHtml = (magicLink: string) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maktab Parent Portal Sign In</title>
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
              <p style="color: #99f6e4; margin: 8px 0 0 0; font-size: 16px;">Parent Portal</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <!-- Islamic Greeting -->
              <p style="font-size: 20px; color: #0f766e; margin: 0 0 8px 0; font-weight: 600; text-align: center;">
                Assalamu Alaikum
              </p>
              <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px 0; text-align: center; font-style: italic;">
                Peace be upon you
              </p>
              
              <p style="font-size: 16px; color: #374151; margin: 0 0 24px 0; line-height: 1.6; text-align: center;">
                Click the button below to sign in to the Parent Portal.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(15, 118, 110, 0.4);">
                      Sign In to Portal
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px 0; text-align: center;">
                This link will expire in 1 hour for security purposes.
              </p>
              
              <!-- Closing -->
              <p style="font-size: 16px; color: #0f766e; margin: 0; font-weight: 600; text-align: center;">
                JazakAllahu Khairan
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0 0 8px 0; text-align: center;">
                If you did not request this sign in link, please ignore this email.
              </p>
              <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">
                Masjid Irshad Maktab • Parent Portal
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

    const { email }: LoginEmailRequest = await req.json();

    if (!email || email.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Sending login magic link to: ${normalizedEmail}`);

    // Check if this email exists as a parent profile
    const { data: parentProfile, error: profileError } = await supabase
      .from("parent_profiles")
      .select("id, email")
      .eq("email", normalizedEmail)
      .single();

    if (profileError || !parentProfile) {
      // Also check if this email is a guardian_email for any student
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, guardian_email")
        .eq("guardian_email", normalizedEmail)
        .limit(1)
        .single();

      if (studentError || !student) {
        console.log(`Email not found in parent profiles or students: ${normalizedEmail}`);
        return new Response(
          JSON.stringify({ 
            error: "Email not found. If you haven't registered yet, please use your student code to sign up first." 
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Always redirect to the portal subdomain
    const redirectUrl = "https://portal.masjidirshad.co.uk/portal/callback";

    console.log(`Generating magic link for ${normalizedEmail} with redirect to ${redirectUrl}`);

    // Generate the magic link using admin API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
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
    console.log(`Magic link generated successfully for ${normalizedEmail}`);

    // Send custom email via Resend if API key is available
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      
      const emailHtml = generateLoginEmailHtml(magicLink);
      
      const { error: emailError } = await resend.emails.send({
        from: "Masjid Irshad Maktab <noreply@masjidirshad.co.uk>",
        to: [normalizedEmail],
        subject: "Sign In to Parent Portal",
        html: emailHtml,
      });

      if (emailError) {
        console.error("Error sending email via Resend:", emailError);
        return new Response(
          JSON.stringify({ error: "Failed to send sign in email. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Sign in email sent successfully to ${normalizedEmail}`);
    } else {
      // Fallback to Supabase OTP if Resend is not configured
      console.log("RESEND_API_KEY not configured, falling back to Supabase OTP");
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
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
        message: "Magic link sent successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in parent-login-email:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
