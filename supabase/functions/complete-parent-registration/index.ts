import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header to identify the user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's token to get their info
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = user.email?.toLowerCase().trim();
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "User email not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Completing registration for user: ${user.id}, email: ${userEmail}`);

    // Check if parent profile already exists
    const { data: existingProfile } = await supabase
      .from("parent_profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (existingProfile) {
      console.log("Parent profile already exists, checking for pending links");
    } else {
      // Create parent profile
      const { error: profileError } = await supabase
        .from("parent_profiles")
        .insert({
          id: user.id,
          email: userEmail,
        });

      if (profileError) {
        console.error("Error creating parent profile:", profileError);
        return new Response(
          JSON.stringify({ error: "Failed to create parent profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Parent profile created");
    }

    // Assign parent role if not already assigned
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "parent")
      .single();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: user.id,
          role: "parent",
        });

      if (roleError) {
        console.error("Error assigning parent role:", roleError);
        // Don't fail the whole request, just log
      } else {
        console.log("Parent role assigned");
      }
    }

    // Check for pending links for this email
    const { data: pendingLinks, error: pendingError } = await supabase
      .from("pending_parent_links")
      .select("*")
      .eq("email", userEmail)
      .gt("expires_at", new Date().toISOString());

    if (pendingError) {
      console.error("Error fetching pending links:", pendingError);
    }

    let studentsLinked = 0;

    if (pendingLinks && pendingLinks.length > 0) {
      for (const pending of pendingLinks) {
        // Find the student
        const { data: student } = await supabase
          .from("students")
          .select("id, name")
          .eq("student_code", pending.student_code)
          .single();

        if (student) {
          // Check if link already exists
          const { data: existingLink } = await supabase
            .from("parent_student_links")
            .select("id")
            .eq("parent_id", user.id)
            .eq("student_id", student.id)
            .single();

          if (!existingLink) {
            // Create the link
            const { error: linkError } = await supabase
              .from("parent_student_links")
              .insert({
                parent_id: user.id,
                student_id: student.id,
                verified_at: new Date().toISOString(),
              });

            if (linkError) {
              console.error("Error creating student link:", linkError);
            } else {
              console.log(`Linked parent to student: ${student.name}`);
              studentsLinked++;
            }
          }
        }

        // Delete the pending link
        await supabase
          .from("pending_parent_links")
          .delete()
          .eq("id", pending.id);
      }
    }

    // ALWAYS check for students with matching email fields (guardian_email, billing_email, portal_invite_email)
    // This ensures siblings with the same parent email are linked together
    const { data: matchingStudents } = await supabase
      .from("students")
      .select("id, name")
      .eq("status", "active")
      .or(`guardian_email.ilike.${userEmail},billing_email.ilike.${userEmail},portal_invite_email.ilike.${userEmail}`);

    if (matchingStudents && matchingStudents.length > 0) {
      for (const student of matchingStudents) {
        // Check if link already exists
        const { data: existingLink } = await supabase
          .from("parent_student_links")
          .select("id")
          .eq("parent_id", user.id)
          .eq("student_id", student.id)
          .maybeSingle();

        if (!existingLink) {
          const { error: linkError } = await supabase
            .from("parent_student_links")
            .insert({
              parent_id: user.id,
              student_id: student.id,
              verified_at: new Date().toISOString(),
            });

          if (!linkError) {
            console.log(`Auto-linked parent to student by email match: ${student.name}`);
            studentsLinked++;
          }
        }
      }
    }

    // Get the count of linked students
    const { data: linkedStudents, error: linkedError } = await supabase
      .from("parent_student_links")
      .select("id, student_id, students(id, name, maktab)")
      .eq("parent_id", user.id);

    // Log the registration activity
    const maktabs = [...new Set(linkedStudents?.map((l: any) => l.students?.maktab).filter(Boolean))];
    const { error: logError } = await supabase
      .from("parent_activity_logs")
      .insert({
        parent_id: user.id,
        parent_email: userEmail,
        activity_type: "registered",
        maktab: maktabs.length === 1 ? maktabs[0] : maktabs.length > 1 ? "both" : null,
      });

    if (logError) {
      console.error("Error logging parent registration:", logError);
    }

    console.log(`Registration complete. ${studentsLinked} new students linked. Total: ${linkedStudents?.length || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        students_linked: studentsLinked,
        total_students: linkedStudents?.length || 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in complete-parent-registration:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
