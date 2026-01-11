import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Reminder {
  id: string;
  teacher_name: string;
  maktab: string;
  reminder_time: string;
  reminder_days: string[];
  notification_email: string;
  is_active: boolean;
}

interface MutePeriod {
  maktab: string | null;
  teacher_name: string | null;
  start_date: string;
  end_date: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this is a test request
    let testReminderId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        testReminderId = body.test_reminder_id || null;
      } catch {
        // No body or invalid JSON, proceed normally
      }
    }

    // Get current time in UK timezone (for the maktab)
    const now = new Date();
    const ukTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);

    const ukDay = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "long",
    }).format(now);

    const ukDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
    }).format(now); // YYYY-MM-DD format

    console.log(`Checking reminders at ${ukTime} on ${ukDay} (${ukDate})${testReminderId ? ` [TEST MODE for ${testReminderId}]` : ''}`);

    // Fetch reminders - either specific one for test, or all active
    let reminders;
    if (testReminderId) {
      const { data, error } = await supabase
        .from("teacher_reminders")
        .select("*")
        .eq("id", testReminderId);
      
      if (error) {
        console.error("Error fetching test reminder:", error);
        throw error;
      }
      reminders = data;
    } else {
      const { data, error } = await supabase
        .from("teacher_reminders")
        .select("*")
        .eq("is_active", true);
      
      if (error) {
        console.error("Error fetching reminders:", error);
        throw error;
      }
      reminders = data;
    }

    if (!reminders || reminders.length === 0) {
      console.log("No reminders found");
      return new Response(JSON.stringify({ message: "No reminders found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch all mute periods that overlap today (skip for test mode)
    let mutePeriods: MutePeriod[] = [];
    if (!testReminderId) {
      const { data, error: muteError } = await supabase
        .from("reminder_mute_periods")
        .select("*")
        .lte("start_date", ukDate)
        .gte("end_date", ukDate);

      if (muteError) {
        console.error("Error fetching mute periods:", muteError);
        throw muteError;
      }
      mutePeriods = data || [];
      console.log(`Found ${mutePeriods.length} active mute periods for ${ukDate}:`, JSON.stringify(mutePeriods));
    }

    const results: { teacher: string; status: string; error?: string }[] = [];

    for (const reminder of reminders as Reminder[]) {
      // Skip time/day checks for test mode
      if (!testReminderId) {
        // Check if reminder matches current time (within 15 min window)
        const [reminderHour, reminderMin] = reminder.reminder_time.split(":").map(Number);
        const [currentHour, currentMin] = ukTime.split(":").map(Number);
        
        const reminderMinutes = reminderHour * 60 + reminderMin;
        const currentMinutes = currentHour * 60 + currentMin;
        
        // Only send if within 15-minute window of the reminder time
        if (Math.abs(currentMinutes - reminderMinutes) > 7) {
          continue;
        }
      }

      // Skip day/mute checks for test mode
      if (!testReminderId) {
        // Check if today is a reminder day
        if (!reminder.reminder_days.includes(ukDay)) {
          console.log(`Skipping ${reminder.teacher_name}: ${ukDay} not in reminder days`);
          continue;
        }

        // Check if muted
        const isMuted = mutePeriods?.some((mute) => {
          // Handle null/undefined - if maktab is null/undefined, it applies to all maktabs
          const matchesMaktab = !mute.maktab || mute.maktab === reminder.maktab;
          // If teacher_name is null/undefined, it applies to all teachers
          const matchesTeacher = !mute.teacher_name || mute.teacher_name === reminder.teacher_name;
          console.log(`Checking mute period: maktab=${mute.maktab}, teacher=${mute.teacher_name}, start=${mute.start_date}, end=${mute.end_date} -> matchesMaktab=${matchesMaktab}, matchesTeacher=${matchesTeacher}`);
          return matchesMaktab && matchesTeacher;
        });

        if (isMuted) {
          console.log(`Skipping ${reminder.teacher_name}: Currently muted`);
          results.push({ teacher: reminder.teacher_name, status: "muted" });
          continue;
        }
      }

      // Check if attendance already taken today
      const { count, error: attendanceError } = await supabase
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("teacher_name", reminder.teacher_name)
        .eq("maktab", reminder.maktab)
        .eq("date", ukDate);

      if (attendanceError) {
        console.error(`Error checking attendance for ${reminder.teacher_name}:`, attendanceError);
      }

      if (count && count > 0) {
        console.log(`Skipping ${reminder.teacher_name}: Attendance already taken today`);
        results.push({ teacher: reminder.teacher_name, status: "already_completed" });
        continue;
      }

      // Send reminder email
      const formattedDate = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(now);

      const maktabDisplay = reminder.maktab === "boys" ? "Boys" : "Girls";
      const appUrl = "https://attendance.masjidirshad.co.uk";

      try {
        const { error: emailError } = await resend.emails.send({
          from: "Maktab Attendance <noreply@masjidirshad.co.uk>",
          to: [reminder.notification_email],
          subject: `📋 Reminder: Take Attendance for ${maktabDisplay} Maktab`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a1a1a; margin-bottom: 20px;">Assalamu Alaykum ${reminder.teacher_name},</h2>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                This is a friendly reminder to complete today's attendance for your class.
              </p>
              
              <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; color: #666;">📅 <strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 0; color: #666;">🏫 <strong>Maktab:</strong> ${maktabDisplay} Maktab</p>
              </div>
              
              <a href="${appUrl}" style="display: inline-block; background: ${reminder.maktab === 'girls' ? '#ec4899' : '#3b82f6'}; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0;">
                Open Attendance App
              </a>
              
              <p style="color: #666; font-size: 14px; margin-top: 32px;">
                JazakAllahu Khayran<br>
                Maktab Attendance System
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
              
              <p style="color: #999; font-size: 12px; line-height: 1.5;">
                Going on holiday or need to pause these reminders? 
                <a href="${appUrl}/admin/reminders#mute-periods" style="color: #666;">Request a mute period</a> 
                from an admin.
              </p>
            </div>
          `,
        });

        if (emailError) {
          console.error(`Error sending email to ${reminder.teacher_name}:`, emailError);
          results.push({ teacher: reminder.teacher_name, status: "error", error: emailError.message });
        } else {
          console.log(`Reminder sent to ${reminder.teacher_name} at ${reminder.notification_email}`);
          results.push({ teacher: reminder.teacher_name, status: "sent" });
        }
      } catch (emailErr: any) {
        console.error(`Exception sending email to ${reminder.teacher_name}:`, emailErr);
        results.push({ teacher: reminder.teacher_name, status: "error", error: emailErr.message });
      }
    }

    return new Response(JSON.stringify({ results, time: ukTime, day: ukDay }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-teacher-reminders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
