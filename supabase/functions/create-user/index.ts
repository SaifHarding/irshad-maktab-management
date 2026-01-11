import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify authentication - extract token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create a client with the user's token to verify their identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.error('Failed to verify user:', userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Check if user has admin role
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !adminRole) {
      console.error('User does not have admin role:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden - Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('Admin user verified:', user.id);

    const { username, password, fullName, email: userEmail, roles, maktab, isHeadTeacher } = await req.json();

    if (!username || !password || !fullName || !roles || !Array.isArray(roles) || roles.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Username, password, full name, and at least one role are required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Validate roles array
    const validRoles = ['admin', 'teacher'];
    if (!roles.every((role: string) => validRoles.includes(role))) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid role provided',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Validate maktab for teacher role or head teacher
    if ((roles.includes('teacher') || isHeadTeacher) && (!maktab || !['boys', 'girls'].includes(maktab))) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Maktab (boys or girls) is required for teachers and head teachers',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // If creating a head teacher, check if one already exists for this maktab
    if (isHeadTeacher) {
      const { data: existingHeadTeacher } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .eq('is_head_teacher', true)
        .eq('maktab', maktab)
        .maybeSingle();

      if (existingHeadTeacher) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `A head teacher already exists for ${maktab === 'boys' ? 'Boys' : 'Girls'} Maktab: ${existingHeadTeacher.full_name}`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        );
      }
    }

    // Create auth user
    const email = `${username.toLowerCase()}@maktab.local`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: authError?.message || 'Failed to create user',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Create profile with is_head_teacher flag
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        username: username.toLowerCase(),
        full_name: fullName,
        email: userEmail || null,
        maktab: (roles.includes('teacher') || isHeadTeacher) ? maktab : null,
        must_change_password: true,
        is_head_teacher: isHeadTeacher || false,
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({
          success: false,
          error: profileError.message,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Assign roles (insert multiple rows)
    // For head teacher, ensure both admin and teacher roles are assigned
    let finalRoles = roles;
    if (isHeadTeacher) {
      const roleSet = new Set(roles);
      roleSet.add('admin');
      roleSet.add('teacher');
      finalRoles = Array.from(roleSet);
    }

    const roleInserts = finalRoles.map((role: string) => ({
      user_id: authData.user.id,
      role,
    }));

    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert(roleInserts);

    if (roleInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({
          success: false,
          error: roleInsertError.message,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    console.log(`User '${username}' created successfully by admin ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `User '${username}' created successfully`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error creating user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
