import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Teacher notification emails
const NOTIFICATION_EMAILS = {
  girls: "nurulainzubair@gmail.com",
  boys: "mmzakbar@gmail.com", // Also handles Hifz
};

interface NotificationRequest {
  studentName: string;
  gender: string;
  registrationType: string; // "regular" or "hifz"
  guardianName: string;
  guardianEmail: string;
  submittedAt: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: NotificationRequest = await req.json();
    console.log("Sending registration notification for:", body.studentName);

    const { studentName, gender, registrationType, guardianName, guardianEmail, submittedAt } = body;

    // Determine which teacher to notify
    const isGirls = gender.toLowerCase() === "female";
    const recipientEmail = isGirls ? NOTIFICATION_EMAILS.girls : NOTIFICATION_EMAILS.boys;
    
    // Determine maktab type for display
    let maktabType = isGirls ? "Girls Maktab" : "Boys Maktab";
    if (registrationType === "hifz") {
      maktabType = "Hifz Programme";
    }

    const formattedDate = new Date(submittedAt).toLocaleString("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Registration Received</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
            <p style="margin: 0 0 20px;">Assalamu Alaikum,</p>
            
            <p style="margin: 0 0 20px;">A new student registration has been submitted for the <strong>${maktabType}</strong> and is awaiting your review.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #1e3a5f; margin: 20px 0;">
              <h3 style="margin: 0 0 15px; color: #1e3a5f;">Registration Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 140px;">Student Name:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${studentName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Programme:</td>
                  <td style="padding: 8px 0;">${maktabType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Guardian:</td>
                  <td style="padding: 8px 0;">${guardianName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Guardian Email:</td>
                  <td style="padding: 8px 0;">${guardianEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Submitted:</td>
                  <td style="padding: 8px 0;">${formattedDate}</td>
                </tr>
              </table>
            </div>
            
            <p style="margin: 20px 0;">Please log in to the Maktab Admin Portal to review and approve or reject this registration.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://portal.masjidirshad.co.uk/app/admin/registrations"
                 style="background: #1e3a5f; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                Review Registration
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
            
            <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">
              This is an automated notification from the Masjid-e-Irshad Maktab System.<br>
              Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Maktab System <noreply@masjidirshad.co.uk>",
      to: [recipientEmail],
      subject: `New ${maktabType} Registration: ${studentName}`,
      html: emailHtml,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Notification email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, emailId: data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
