import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyCodeRequest {
  student_code: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { student_code }: VerifyCodeRequest = await req.json();

    if (!student_code || student_code.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Student code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedCode = student_code.trim().toUpperCase();
    console.log(`Verifying student code: ${normalizedCode}`);

    // Find the student by code
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, student_code, guardian_email, maktab, status")
      .eq("student_code", normalizedCode)
      .single();

    if (studentError || !student) {
      console.log(`Student not found for code: ${normalizedCode}`);
      return new Response(
        JSON.stringify({ error: "Invalid student code. Please check and try again." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (student.status !== "active") {
      return new Response(
        JSON.stringify({ error: "This student is no longer active. Please contact admin." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!student.guardian_email) {
      return new Response(
        JSON.stringify({ 
          error: "No guardian email on file for this student. Please contact admin to update your details." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mask the email for display (e.g., "f***@gmail.com")
    const email = student.guardian_email;
    const [localPart, domain] = email.split("@");
    const maskedLocal = localPart.length > 1 
      ? localPart[0] + "***" 
      : localPart + "***";
    const maskedEmail = `${maskedLocal}@${domain}`;

    console.log(`Student found: ${student.name}, masked email: ${maskedEmail}`);

    return new Response(
      JSON.stringify({
        success: true,
        student_name: student.name,
        masked_email: maskedEmail,
        student_code: student.student_code,
        maktab: student.maktab,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in verify-student-code:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
