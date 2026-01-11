import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RejectionEmailRequest {
  guardianEmail: string;
  guardianName: string;
  studentName: string;
  rejectionReason: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RejectionEmailRequest = await req.json();
    const { guardianEmail, guardianName, studentName, rejectionReason } = body;

    if (!guardianEmail || !studentName || !rejectionReason) {
      throw new Error("Missing required fields: guardianEmail, studentName, or rejectionReason");
    }

    console.log(`Sending rejection email to ${guardianEmail} for ${studentName}`);

    const emailResponse = await resend.emails.send({
      from: "Masjid Irshad <noreply@masjidirshad.co.uk>",
      to: [guardianEmail],
      subject: `Registration Update - ${studentName} - Masjid Irshad`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2d5a87; margin-bottom: 10px;">Registration Update</h1>
            <p style="color: #666; font-size: 16px;">Masjid Irshad</p>
          </div>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="margin: 0;">Assalamu Alaykum <strong>${guardianName}</strong>,</p>
            <p style="margin-top: 15px;">Thank you for submitting a registration for <strong>${studentName}</strong>.</p>
            <p style="margin-top: 10px;">After reviewing the application, we regret to inform you that the registration could not be approved at this time.</p>
          </div>

          <div style="background: #fff3cd; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
            <h3 style="margin-top: 0; color: #856404;">Reason Provided</h3>
            <p style="margin-bottom: 0; color: #856404;">${rejectionReason}</p>
          </div>

          <div style="background: #e8f4fd; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #2d5a87;">
            <h3 style="margin-top: 0; color: #1e3a5f;">Next Steps</h3>
            <p style="margin-bottom: 0;">If you believe this decision was made in error or if you would like to discuss this further, please contact the Maktab administration directly. We are happy to assist with any questions you may have.</p>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <div style="text-align: center; color: #666; font-size: 14px;">
            <p style="margin-bottom: 10px;">If you have any questions, please don't hesitate to contact us.</p>
            <p style="margin: 0;"><strong>Masjid Irshad</strong></p>
            <p style="margin: 5px 0; font-size: 12px; color: #888;">This is an automated message. Please do not reply directly to this email.</p>
          </div>

        </body>
        </html>
      `,
    });

    console.log("Rejection email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-registration-rejection function:", error);
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
