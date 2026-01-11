import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StudentInfo {
  name: string;
  code: string;
  maktab: string;
  isHifz?: boolean;
}

interface RegistrationConfirmationRequest {
  guardianEmail: string;
  guardianName: string;
  // Support single student (legacy) or multiple students
  studentName?: string;
  studentCode?: string;
  maktab?: string;
  isHifz?: boolean;
  // New: array of students for batch approval
  students?: StudentInfo[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RegistrationConfirmationRequest = await req.json();
    const { guardianEmail, guardianName } = body;

    // Build students array from either new format or legacy format
    let students: StudentInfo[] = [];
    if (body.students && body.students.length > 0) {
      students = body.students;
    } else if (body.studentName && body.studentCode && body.maktab) {
      students = [{
        name: body.studentName,
        code: body.studentCode,
        maktab: body.maktab,
        isHifz: body.isHifz,
      }];
    }

    if (students.length === 0) {
      throw new Error("No student information provided");
    }

    console.log(`Sending registration confirmation to ${guardianEmail} for ${students.length} student(s)`);

    const portalUrl = "https://attendance.masjidirshad.co.uk/portal";
    
    // Build subject line
    const studentNames = students.map(s => s.name).join(", ");
    const subjectLine = students.length === 1
      ? `Registration Approved - ${students[0].name} - Masjid Irshad`
      : `Registrations Approved - ${students.length} Children - Masjid Irshad`;

    // Build student details section
    const studentDetailsHtml = students.map((student, index) => {
      const programType = student.isHifz ? "Hifz Programme" : `${student.maktab === "boys" ? "Boys" : "Girls"} Maktab`;
      return `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><strong>${student.name}</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><span style="font-family: monospace; background: #fff; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${student.code}</span></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;">${programType}</td>
        </tr>
      `;
    }).join("");

    // Build intro text
    const introText = students.length === 1
      ? `We are pleased to inform you that <strong>${students[0].name}</strong>'s registration has been <span style="color: #28a745; font-weight: bold;">approved</span>.`
      : `We are pleased to inform you that the following ${students.length} children have had their registrations <span style="color: #28a745; font-weight: bold;">approved</span>.`;

    const emailResponse = await resend.emails.send({
      from: "Masjid Irshad <noreply@masjidirshad.co.uk>",
      to: [guardianEmail],
      subject: subjectLine,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2d5a87; margin-bottom: 10px;">Registration${students.length > 1 ? 's' : ''} Approved! ✓</h1>
            <p style="color: #666; font-size: 16px;">Masjid Irshad</p>
          </div>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="margin: 0;">Assalamu Alaykum <strong>${guardianName}</strong>,</p>
            <p style="margin-top: 15px;">${introText}</p>
          </div>

          <div style="background: #e8f5e9; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
            <h3 style="margin-top: 0; color: #2e7d32;">Student Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background: #c8e6c9;">
                <th style="padding: 8px; text-align: left;">Name</th>
                <th style="padding: 8px; text-align: left;">Code</th>
                <th style="padding: 8px; text-align: left;">Programme</th>
              </tr>
              ${studentDetailsHtml}
            </table>
          </div>

          <div style="background: #fff3cd; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="margin-top: 0; color: #856404;">📋 3 Tasks to Complete</h3>
            <p style="margin-bottom: 15px; color: #856404;">Please complete the following tasks to finalise your ${students.length > 1 ? "children's" : "child's"} enrolment:</p>
          </div>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #6c757d;">
            <h3 style="margin-top: 0; color: #495057;">1️⃣ Payment</h3>
            <p style="margin-bottom: 0;">The Maktab administration will reach out to you with payment details. Please await further communication regarding fees and payment methods.</p>
          </div>

          <div style="background: #f0f7ff; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h3 style="margin-top: 0; color: #1e40af;">2️⃣ Books</h3>
            <p style="margin-bottom: 15px;">Book requirements depend on your ${students.length > 1 ? "children's levels" : "child's level"}. We use Safar Publications books across all levels; however, not all students will require every book listed below.</p>
            
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
            
            <p style="margin-bottom: 15px; font-style: italic; color: #555;">If you are unsure which books your ${students.length > 1 ? "children need" : "child needs"}, please confirm with their teacher before purchasing.</p>
            <p style="margin-bottom: 10px;">Books can be purchased:</p>
            <ul style="margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Online from the <a href="https://www.safarpublications.org" style="color: #1e40af; text-decoration: underline;">Safar Publications website</a></li>
              <li style="margin-bottom: 8px;">In person from <strong>Amsons</strong> in Bury Park, Luton - <a href="https://maps.app.goo.gl/kdq8fBYysMSAM6dr9" style="color: #1e40af; text-decoration: underline;">View on Google Maps</a></li>
            </ul>
          </div>

          <div style="background: #e8f4fd; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #2d5a87;">
            <h3 style="margin-top: 0; color: #1e3a5f;">3️⃣ Parent Portal Setup</h3>
            <p style="margin-bottom: 15px;">As a parent/guardian, you have access to our <strong>Parent Portal</strong> where you can:</p>
            <ul style="margin: 0 0 20px 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;"><strong>View Attendance:</strong> Track your ${students.length > 1 ? "children's" : "child's"} attendance records and history</li>
              <li style="margin-bottom: 8px;"><strong>Monitor Progress:</strong> See your ${students.length > 1 ? "children's" : "child's"} learning progress through Qaidah, Quran, and other subjects</li>
              <li style="margin-bottom: 8px;"><strong>Receive Updates:</strong> Get important announcements and notifications from the Masjid</li>
              <li style="margin-bottom: 8px;"><strong>Manage Profile:</strong> Keep your contact information up to date</li>
            </ul>
            <p style="margin-bottom: 15px; font-style: italic; color: #555;">Sign in using your registered email address: <strong>${guardianEmail}</strong></p>
            <div style="text-align: center;">
              <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #2d5a87 0%, #1e3a5f 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                🔗 Access Parent Portal
              </a>
            </div>
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

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-registration-confirmation function:", error);
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
