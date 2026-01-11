import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify API key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("REGISTRATION_API_KEY");

    if (!apiKey || apiKey !== expectedKey) {
      console.error("Invalid API key provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    console.log("Received Hifz registration:", JSON.stringify(body, null, 2));

    // Determine if under 18 or adult based on age
    const age = parseInt(body.studentAge, 10);
    const isMinor = age < 18;

    // Validate required fields based on age
    const baseRequired = ["firstName", "lastName", "studentAge", "previousExperience"];
    const minorRequired = [...baseRequired, "guardianName", "guardianContact", "guardianEmail", "address", "town", "postcode"];
    const adultRequired = [...baseRequired, "contactNumber", "email"];
    
    const required = isMinor ? minorRequired : adultRequired;
    const missing = required.filter((field) => !body[field] && body[field] !== false);

    if (missing.length > 0) {
      console.error("Missing required fields:", missing);
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missing.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build registration data
    const registrationData: Record<string, any> = {
      first_name: body.firstName.trim(),
      middle_name: null,
      last_name: body.lastName.trim(),
      date_of_birth: null, // We have age instead
      place_of_birth: `Age: ${age}${body.previousExperience ? " (Has previous Quran memorization experience)" : " (No previous experience)"}`,
      gender: "Male", // Hifz is for boys
      status: "pending",
      registration_type: "hifz",
    };

    if (isMinor) {
      // Under 18 - use parent/guardian info
      registrationData.guardian_name = body.guardianName.trim();
      registrationData.mobile_contact = body.guardianContact.trim();
      registrationData.guardian_email = body.guardianEmail.trim().toLowerCase();
      registrationData.address = body.town ? `${body.address.trim()}, ${body.town.trim()}` : body.address.trim();
      registrationData.post_code = body.postcode.trim().toUpperCase();
      registrationData.home_contact = null;
      registrationData.ethnic_origin = body.additionalNotes?.trim() || null;
    } else {
      // 18 or over - use their own contact info
      registrationData.guardian_name = "Self (Adult)";
      registrationData.mobile_contact = body.contactNumber.trim();
      registrationData.guardian_email = body.email.trim().toLowerCase();
      registrationData.address = "Adult applicant";
      registrationData.post_code = "N/A";
      registrationData.home_contact = null;
      registrationData.ethnic_origin = body.additionalNotes?.trim() || null;
    }

    // Insert into pending_registrations
    const { data: registration, error: insertError } = await supabase
      .from("pending_registrations")
      .insert(registrationData)
      .select("id, first_name, last_name")
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to submit registration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Hifz registration submitted successfully:", registration);

    // Send notification email to teacher (fire and forget)
    try {
      const notificationPayload = {
        studentName: `${registration.first_name} ${registration.last_name}`,
        gender: "Male",
        registrationType: "hifz",
        guardianName: registrationData.guardian_name,
        guardianEmail: registrationData.guardian_email,
        submittedAt: new Date().toISOString(),
      };
      
      // Call the notification function
      const notifyResponse = await fetch(
        `${supabaseUrl}/functions/v1/notify-new-registration`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(notificationPayload),
        }
      );
      
      if (!notifyResponse.ok) {
        console.error("Failed to send teacher notification:", await notifyResponse.text());
      } else {
        console.log("Teacher notification sent successfully");
      }
    } catch (notifyError) {
      console.error("Error sending teacher notification:", notifyError);
      // Don't fail the registration if notification fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Hifz registration submitted for review",
        registration: {
          id: registration.id,
          name: `${registration.first_name} ${registration.last_name}`,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
