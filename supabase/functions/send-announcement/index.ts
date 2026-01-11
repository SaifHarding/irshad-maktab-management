import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnnouncementRequest {
  subject: string;
  message: string;
  imageUrl?: string;
  maktabFilter?: "all" | "boys" | "girls";
  scheduledAt?: string; // ISO date string for scheduled announcements
  expiresAt?: string; // ISO date string for when announcement expires
  announcementId?: string; // For processing scheduled announcements
}

async function sendAnnouncementEmails(
  supabase: any,
  announcementId: string,
  subject: string,
  message: string,
  imageUrl: string | undefined,
  maktabFilter: string
) {
  console.log(`Sending announcement: "${subject}" to ${maktabFilter} parents`);

  // Get all registered parents with their linked students
  const { data: parentLinks, error: linksError } = await supabase
    .from("parent_student_links")
    .select(`
      parent_id,
      student_id,
      students!inner(maktab)
    `)
    .not("verified_at", "is", null);

  if (linksError) {
    console.error("Error fetching parent links:", linksError);
    throw linksError;
  }

  // Filter by maktab if specified
  let filteredLinks = parentLinks || [];
  if (maktabFilter !== "all") {
    filteredLinks = filteredLinks.filter((link: any) => 
      link.students?.maktab === maktabFilter
    );
  }

  // Get unique parent IDs
  const uniqueParentIds = [...new Set(filteredLinks.map((link: any) => link.parent_id))];

  if (uniqueParentIds.length === 0) {
    // Update announcement as sent with 0 emails
    await supabase
      .from("announcements")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        emails_sent: 0,
        emails_failed: 0,
      })
      .eq("id", announcementId);

    return { emailsSent: 0, emailsFailed: 0, notificationsCreated: 0 };
  }

  // Get parent profiles with emails
  const { data: parentProfiles, error: profilesError } = await supabase
    .from("parent_profiles")
    .select("id, email, full_name")
    .in("id", uniqueParentIds);

  if (profilesError) {
    console.error("Error fetching parent profiles:", profilesError);
    throw profilesError;
  }

  console.log(`Found ${parentProfiles?.length || 0} parents to notify`);

  // Create notifications in the database for each parent
  const notifications = uniqueParentIds.map(parentId => ({
    parent_id: parentId,
    title: subject,
    message: imageUrl ? `${message}\n\n[Image attached]` : message,
    is_read: false,
  }));

  const { error: notifError } = await supabase
    .from("parent_notifications")
    .insert(notifications);

  if (notifError) {
    console.error("Error creating notifications:", notifError);
  }

  // Build email HTML
  const imageHtml = imageUrl 
    ? `<div style="margin: 20px 0;"><img src="${imageUrl}" alt="Announcement image" style="max-width: 100%; height: auto; border-radius: 8px;" /></div>`
    : "";

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📢 Masjid Irshad Maktab</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Announcement</p>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">${subject}</h2>
          
          ${imageHtml}
          
          <div style="white-space: pre-wrap; color: #4b5563;">${message}</div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 14px;">
            You can also view this announcement in your Parent Portal.
          </p>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
            This email was sent by Masjid Irshad Maktab. Please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `;

  // Send emails to all parents
  let successCount = 0;
  let failCount = 0;

  for (const parent of parentProfiles || []) {
    try {
      const { error: emailError } = await resend.emails.send({
        from: "Masjid Irshad Maktab <noreply@masjidirshad.co.uk>",
        to: [parent.email],
        subject: `📢 ${subject}`,
        html: emailHtml,
      });

      if (emailError) {
        console.error(`Failed to send email to ${parent.email}:`, emailError);
        failCount++;
      } else {
        console.log(`Email sent to ${parent.email}`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`Error sending to ${parent.email}:`, err);
      failCount++;
    }
  }

  console.log(`Announcement sent: ${successCount} successful, ${failCount} failed`);

  // Update announcement record
  await supabase
    .from("announcements")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      emails_sent: successCount,
      emails_failed: failCount,
    })
    .eq("id", announcementId);

  return {
    emailsSent: successCount,
    emailsFailed: failCount,
    notificationsCreated: notifications.length,
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { subject, message, imageUrl, maktabFilter = "all", scheduledAt, expiresAt, announcementId }: AnnouncementRequest = await req.json();

    // If announcementId is provided, this is a scheduled announcement being processed
    if (announcementId) {
      const { data: announcement, error: fetchError } = await supabase
        .from("announcements")
        .select("*")
        .eq("id", announcementId)
        .single();

      if (fetchError || !announcement) {
        throw new Error("Announcement not found");
      }

      const result = await sendAnnouncementEmails(
        supabase,
        announcementId,
        announcement.subject,
        announcement.message,
        announcement.image_url,
        announcement.maktab_filter
      );

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!subject || !message) {
      return new Response(
        JSON.stringify({ error: "Subject and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the user from the authorization header
    const authHeader = req.headers.get("Authorization");
    let createdBy = "00000000-0000-0000-0000-000000000000";
    let createdByName = "System";

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        createdBy = user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        createdByName = profile?.full_name || "Admin";
      }
    }

    // Create the announcement record
    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();
    
    const { data: announcement, error: insertError } = await supabase
      .from("announcements")
      .insert({
        subject,
        message,
        image_url: imageUrl,
        maktab_filter: maktabFilter,
        scheduled_at: scheduledAt || null,
        expires_at: expiresAt || null,
        status: isScheduled ? "scheduled" : "pending",
        created_by: createdBy,
        created_by_name: createdByName,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating announcement:", insertError);
      throw insertError;
    }

    // If scheduled for future, just return success
    if (isScheduled) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Announcement scheduled for ${new Date(scheduledAt!).toLocaleString()}`,
          announcementId: announcement.id,
          scheduled: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send immediately
    const result = await sendAnnouncementEmails(
      supabase,
      announcement.id,
      subject,
      message,
      imageUrl,
      maktabFilter
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Announcement sent to ${result.emailsSent} parents`,
        ...result,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-announcement function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
