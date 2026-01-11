import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Check if requesting user is admin
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "admin")
      .single();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Not authorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const { userId, username, fullName, email, roles, maktab, isHeadTeacher } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "User ID is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // If promoting to head teacher, check if one already exists for this maktab
    if (isHeadTeacher && maktab) {
      const { data: existingHeadTeacher } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_head_teacher", true)
        .eq("maktab", maktab)
        .neq("id", userId) // Exclude current user
        .maybeSingle();

      if (existingHeadTeacher) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `A head teacher already exists for ${maktab === 'boys' ? 'Boys' : 'Girls'} Maktab: ${existingHeadTeacher.full_name}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    // Update profile
    const updateData: Record<string, unknown> = {};
    if (username !== undefined) updateData.username = username;
    if (fullName !== undefined) updateData.full_name = fullName;
    if (email !== undefined) updateData.email = email;
    if (maktab !== undefined) updateData.maktab = maktab;
    if (isHeadTeacher !== undefined) updateData.is_head_teacher = isHeadTeacher;

    if (Object.keys(updateData).length > 0) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (profileError) {
        return new Response(
          JSON.stringify({ success: false, error: profileError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    // Update roles if provided
    if (roles !== undefined && Array.isArray(roles)) {
      // For head teacher, ensure both admin and teacher roles are assigned
      let finalRoles = roles;
      if (isHeadTeacher) {
        const roleSet = new Set(roles);
        roleSet.add('admin');
        roleSet.add('teacher');
        finalRoles = Array.from(roleSet);
      }

      // Delete existing roles
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ success: false, error: deleteError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Insert new roles
      if (finalRoles.length > 0) {
        const roleInserts = finalRoles.map((role: string) => ({
          user_id: userId,
          role: role,
        }));

        const { error: insertError } = await supabase
          .from("user_roles")
          .insert(roleInserts);

        if (insertError) {
          return new Response(
            JSON.stringify({ success: false, error: insertError.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
