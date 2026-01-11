import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting create-initial-admin function...");

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get username and password from request
    const { username, password, fullName } = await req.json();

    console.log('Request params:', { username, hasPassword: !!password });

    if (!username || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Username and password are required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Validate username
    if (username.length < 3 || username.length > 20) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Username must be between 3 and 20 characters',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Validate password
    if (password.length < 6) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Password must be at least 6 characters',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // If a profile with this username already exists, delete the underlying auth user first
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', username.toLowerCase())
      .single();

    if (existingProfile) {
      console.log('Deleting existing user before recreating admin:', existingProfile.username);
      await supabase.auth.admin.deleteUser(existingProfile.id);
    }

    // Create auth user
    const email = `${username.toLowerCase()}@maktab.local`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Failed to create user');
    }

    console.log('Auth user created:', authData.user.id);

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        username: username.toLowerCase(),
        full_name: fullName || username,
        must_change_password: false, // Initial admin chooses their own password
      });

    if (profileError) {
      console.error('Profile error, rolling back user:', profileError);
      // Rollback: delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    // Assign admin role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'admin',
      });

    if (roleError) {
      console.error('Role error, rolling back user:', roleError);
      // Rollback: delete the auth user (cascade will delete profile)
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw roleError;
    }

    console.log('Initial admin user created successfully:', username);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Admin user '${username}' created successfully. You can now log in.`,
        username: username.toLowerCase(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error creating initial admin:', error);
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
