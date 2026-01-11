import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PaymentConfirmationRequest {
  guardianEmail: string;
  guardianName: string;
  studentName: string;
  studentCode: string;
  maktab: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PaymentConfirmationRequest = await req.json();
    const { guardianEmail, guardianName, studentName, studentCode, maktab } = body;

    console.log(`Sending payment confirmation to ${guardianEmail} for ${studentName}`);

    const portalUrl = "https://attendance.masjidirshad.co.uk/portal";
    const programme = maktab === "boys" ? "Boys Maktab" : "Girls Maktab";

    const emailResponse = await resend.emails.send({
      from: "Masjid Irshad <noreply@masjidirshad.co.uk>",
      to: [guardianEmail],
      subject: `Registration Confirmation - ${studentName} - Masjid Irshad`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="color: #2d5a87; margin-bottom: 5px;">Masjid Irshad</h2>
            <h1 style="color: #333; margin-top: 0;">Registration Confirmation</h1>
          </div>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="margin: 0;">Assalamu Alaikum ${guardianName},</p>
            <p style="margin-top: 15px;">We are pleased to inform you that the registration for <strong>${studentName}</strong> has been completed.</p>
          </div>

          <div style="background: #e8f5e9; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
            <h3 style="margin-top: 0; color: #2e7d32;">Registration Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Student Name:</td>
                <td style="padding: 8px 0; font-weight: bold;">${studentName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Student Code:</td>
                <td style="padding: 8px 0;"><span style="font-family: monospace; background: #fff; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${studentCode}</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Programme:</td>
                <td style="padding: 8px 0; font-weight: bold;">${programme}</td>
              </tr>
            </table>
          </div>

          <div style="background: #f0f7ff; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h3 style="margin-top: 0; color: #1e40af;">📚 Required Books</h3>
            <p style="margin-bottom: 15px;">Book requirements depend on your child's level. We use Safar Publications books across all levels; however, not all students will require every book listed below.</p>
            
            <p style="margin-bottom: 8px; font-weight: 600; color: #1e40af;">Beginner Level</p>
            <ul style="margin: 0 0 15px 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Safar Qaidah</li>
              <li style="margin-bottom: 8px;">Safar Dua Book 1</li>
            </ul>
            
            <p style="margin-bottom: 8px; font-weight: 600; color: #1e40af;">Intermediate / Advanced Level</p>
            <ul style="margin: 0 0 15px 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Qur'an (edition and size depend on your child's reading level)</li>
              <li style="margin-bottom: 8px;">Safar Tajweed</li>
              <li style="margin-bottom: 8px;">Safar Dua Book 2 (if required)</li>
            </ul>
            
            <p style="margin-bottom: 15px; font-style: italic; color: #555;">If you are unsure which books your child needs, please confirm with their teacher before purchasing.</p>
            <p style="margin-bottom: 10px;">Books can be purchased:</p>
            <ul style="margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Online from the <a href="https://www.safarpublications.org" style="color: #1e40af; text-decoration: underline;">Safar Publications website</a></li>
              <li style="margin-bottom: 8px;">In person from <strong>Amsons</strong> in Bury Park, Luton - <a href="https://maps.app.goo.gl/kdq8fBYysMSAM6dr9" style="color: #1e40af; text-decoration: underline;">View on Google Maps</a></li>
            </ul>
          </div>

          <div style="background: #e8f4fd; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #2d5a87;">
            <h3 style="margin-top: 0; color: #1e3a5f;">Parent Portal Access</h3>
            <p style="margin-bottom: 15px;">As a parent/guardian, you now have access to our <strong>Parent Portal</strong> where you can:</p>
            <ul style="margin: 0 0 20px 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;"><strong>View Attendance:</strong> Track your child's attendance records and history</li>
              <li style="margin-bottom: 8px;"><strong>Monitor Progress:</strong> See your child's learning progress through Qaidah, Quran, and other subjects</li>
              <li style="margin-bottom: 8px;"><strong>Receive Updates:</strong> Get important announcements and notifications from the Masjid</li>
              <li style="margin-bottom: 8px;"><strong>Manage Profile:</strong> Keep your contact information up to date</li>
              <li style="margin-bottom: 8px;"><strong>Payments:</strong> Make amendments to payment details</li>
            </ul>
            <p style="margin-bottom: 15px; font-style: italic; color: #555;">To sign in, use the email address associated with this registration (<strong>${guardianEmail}</strong>). You will receive a secure login link.</p>
            <div style="text-align: center;">
              <a href="${portalUrl}" style="display: inline-block; background: #28a745; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4); text-transform: uppercase; letter-spacing: 1px;">
                Access Parent Portal
              </a>
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <div style="text-align: center; color: #666; font-size: 14px;">
            <p style="margin-bottom: 10px;">JazakAllahu Khairan,</p>
            <p style="margin: 0;"><strong>Masjid Irshad Maktab Team</strong></p>
          </div>

        </body>
        </html>
      `,
    });

    console.log("Payment confirmation email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-payment-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
