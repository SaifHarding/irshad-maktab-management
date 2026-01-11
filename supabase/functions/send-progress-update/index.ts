import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProgressUpdateRequest {
  studentId: string;
  studentName: string;
  snapshotMonth: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { studentId, studentName, snapshotMonth }: ProgressUpdateRequest = await req.json();

    console.log(`Processing progress update notification for student ${studentName} (${studentId})`);

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find linked parents for this student
    const { data: parentLinks, error: linksError } = await supabase
      .from("parent_student_links")
      .select(`
        parent_id,
        parent_profiles(email, full_name)
      `)
      .eq("student_id", studentId)
      .not("verified_at", "is", null);

    if (linksError) {
      console.error("Error fetching parent links:", linksError);
      throw linksError;
    }

    if (!parentLinks || parentLinks.length === 0) {
      console.log(`No linked parents found for student ${studentId}`);
      return new Response(
        JSON.stringify({ success: true, message: "No linked parents to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${parentLinks.length} linked parent(s) to notify`);

    const portalUrl = "https://attendance.masjidirshad.co.uk/portal/progress";
    
    // Format the month nicely
    const [year, month] = snapshotMonth.split("-");
    const monthDate = new Date(parseInt(year), parseInt(month) - 1);
    const formattedMonth = monthDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const link of parentLinks) {
      const parentProfile = link.parent_profiles as unknown as { email: string; full_name: string | null } | null;
      if (!parentProfile || !parentProfile.email) {
        console.log(`Skipping link with missing parent profile for parent_id ${link.parent_id}`);
        continue;
      }
      
      const parentName = parentProfile.full_name || "Parent/Guardian";
      const parentEmail = parentProfile.email;

      try {
        const emailResponse = await resend.emails.send({
          from: "Masjid Irshad <noreply@masjidirshad.co.uk>",
          to: [parentEmail],
          subject: `Progress Report Updated - ${studentName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Masjid Irshad</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Progress Report Update</p>
              </div>
              
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
                <p style="margin-top: 0;">Assalamu Alaikum <strong>${parentName}</strong>,</p>
                
                <p>We are pleased to inform you that the progress report for <strong>${studentName}</strong> has been updated for <strong>${formattedMonth}</strong>.</p>
                
                <div style="background: #e8f4fd; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #2d5a87;">
                  <h3 style="margin-top: 0; color: #1e3a5f;">What's Included</h3>
                  <p style="margin-bottom: 0;">The progress report includes updates on your child's learning journey, including:</p>
                  <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    <li>Current level and achievements</li>
                    <li>Monthly progress tracking</li>
                    <li>Learning milestones</li>
                  </ul>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    View Progress Report
                  </a>
                </div>

                <p style="font-size: 14px; color: #666;">Sign in to the Parent Portal using your registered email address to view the full progress report.</p>

                <hr style="border: none; border-top: 1px solid #e9ecef; margin: 25px 0;">
                
                <p style="margin-bottom: 0; color: #666; font-size: 14px;">
                  JazakAllahu Khairan,<br>
                  <strong>Masjid Irshad Maktab Team</strong>
                </p>
              </div>
              
              <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">
                This email was sent from Masjid Irshad. Please do not reply to this email.
              </p>
            </body>
            </html>
          `,
        });

        console.log(`Progress update email sent to ${parentEmail}:`, emailResponse);
        emailsSent++;
      } catch (emailErr) {
        console.error(`Failed to send email to ${parentEmail}:`, emailErr);
        emailsFailed++;
      }
    }

    console.log(`Progress update notifications complete: ${emailsSent} sent, ${emailsFailed} failed`);

    return new Response(
      JSON.stringify({ success: true, emailsSent, emailsFailed }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-progress-update function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
