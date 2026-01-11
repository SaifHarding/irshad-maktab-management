import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Legacy single-child registration (for backwards compatibility)
interface LegacyRegistrationRequest {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  gender: string;
  address: string;
  townCity: string;
  postcode: string;
  homeTelephone?: string;
  fatherMobile: string;
  email: string;
  guardianName: string;
  ethnicOrigin?: string;
}

// New batch registration format
interface ChildRegistration {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  gender: string; // "Male" or "Female"
  level: string;  // "qaidah" or "quran"
  medicalNotes?: string; // Any serious illness/disability
}

interface BatchRegistrationRequest {
  guardianName: string;
  email: string;
  address: string;
  townCity: string;
  postcode: string;
  homeTelephone?: string;
  ethnicOrigin?: string;
  fatherMobile?: string;  // Required if any boys
  motherMobile?: string;  // Required if any girls
  motherName?: string;    // Required if any girls
  termsAccepted: boolean; // Parent must accept terms for all children
  children: ChildRegistration[];
}

function isLegacyRequest(body: any): body is LegacyRegistrationRequest {
  return body.firstName !== undefined && body.children === undefined;
}

function mapLevelToGroup(level: string): string {
  const levelLower = level.toLowerCase();
  if (levelLower === "qaidah") return "A";
  if (levelLower === "quran") return "B";
  return "A"; // Default to Qaidah
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = Deno.env.get("REGISTRATION_API_KEY");
    
    if (!expectedApiKey) {
      console.error("REGISTRATION_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error("Invalid or missing API key");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle legacy single-child format for backwards compatibility
    if (isLegacyRequest(body)) {
      console.log("Processing legacy single-child registration");
      return await handleLegacyRegistration(body, supabase, supabaseUrl, supabaseServiceKey);
    }

    // Handle new batch registration format
    const batchBody = body as BatchRegistrationRequest;
    console.log("Processing batch registration with", batchBody.children?.length || 0, "children");

    // Validate children array
    if (!batchBody.children || !Array.isArray(batchBody.children) || batchBody.children.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one child is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (batchBody.children.length > 6) {
      return new Response(
        JSON.stringify({ error: "Maximum 6 children allowed per registration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate terms acceptance
    if (!batchBody.termsAccepted) {
      return new Response(
        JSON.stringify({ error: "You must accept the terms and conditions to proceed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required guardian fields
    const requiredGuardianFields = ["guardianName", "email", "address", "townCity", "postcode"];
    const missingGuardianFields = requiredGuardianFields.filter(field => !batchBody[field as keyof BatchRegistrationRequest]);
    if (missingGuardianFields.length > 0) {
      return new Response(
        JSON.stringify({ error: `Missing required guardian fields: ${missingGuardianFields.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each child
    const requiredChildFields = ["firstName", "lastName", "dateOfBirth", "placeOfBirth", "gender", "level"];
    for (let i = 0; i < batchBody.children.length; i++) {
      const child = batchBody.children[i];
      const missingChildFields = requiredChildFields.filter(field => !child[field as keyof ChildRegistration]);
      if (missingChildFields.length > 0) {
        return new Response(
          JSON.stringify({ error: `Child ${i + 1}: Missing required fields: ${missingChildFields.join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const genderLower = child.gender.toLowerCase();
      if (genderLower !== "male" && genderLower !== "female") {
        return new Response(
          JSON.stringify({ error: `Child ${i + 1}: Gender must be 'Male' or 'Female'` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const levelLower = child.level.toLowerCase();
      if (levelLower !== "qaidah" && levelLower !== "quran") {
        return new Response(
          JSON.stringify({ error: `Child ${i + 1}: Level must be 'qaidah' or 'quran'` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Determine required contact numbers based on genders
    const hasBoys = batchBody.children.some(c => c.gender.toLowerCase() === "male");
    const hasGirls = batchBody.children.some(c => c.gender.toLowerCase() === "female");

    if (hasBoys && !batchBody.fatherMobile) {
      return new Response(
        JSON.stringify({ error: "Father's mobile number is required when registering boys" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (hasGirls && !batchBody.motherMobile) {
      return new Response(
        JSON.stringify({ error: "Mother's mobile number is required when registering girls" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (hasGirls && !batchBody.motherName) {
      return new Response(
        JSON.stringify({ error: "Mother's name is required when registering girls" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Combine address with town/city
    const fullAddress = `${batchBody.address}, ${batchBody.townCity}`;

    // Create students immediately with pending_payment status and send payment links
    const createdStudents: { id: string; name: string; maktab: string; studentCode: string }[] = [];
    const childNames: string[] = [];

    for (const child of batchBody.children) {
      const isBoy = child.gender.toLowerCase() === "male";
      const maktab = isBoy ? "boys" : "girls";
      const studentGroup = mapLevelToGroup(child.level);
      
      // Build full name
      const nameParts = [child.firstName];
      if (child.middleName?.trim()) {
        nameParts.push(child.middleName.trim());
      }
      nameParts.push(child.lastName);
      const fullName = nameParts.join(" ");
      childNames.push(fullName);

      console.log("Creating student with pending_payment status:", { 
        name: fullName,
        gender: child.gender,
        maktab,
        group: studentGroup
      });

      // Create student record directly with pending_payment status
      const { data: student, error: studentError } = await supabase
        .from("students")
        .insert({
          name: fullName,
          maktab,
          student_group: studentGroup,
          gender: child.gender,
          date_of_birth: child.dateOfBirth,
          place_of_birth: child.placeOfBirth,
          address: fullAddress,
          post_code: batchBody.postcode,
          home_contact: batchBody.homeTelephone || null,
          mobile_contact: isBoy ? batchBody.fatherMobile : batchBody.motherMobile,
          guardian_email: batchBody.email,
          guardian_name: batchBody.guardianName,
          ethnic_origin: batchBody.ethnicOrigin || null,
          medical_notes: child.medicalNotes?.trim() || null,
          status: "pending_payment",
          admission_date: new Date().toISOString().split("T")[0],
        })
        .select("id, student_code, name")
        .single();

      if (studentError) {
        console.error("Failed to create student:", fullName, studentError);
        return new Response(
          JSON.stringify({ error: `Failed to create student record for ${fullName}`, details: studentError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      createdStudents.push({
        id: student.id,
        name: fullName,
        maktab,
        studentCode: student.student_code,
      });

      // Also create a pending_registration record for audit trail
      const pendingData = {
        first_name: child.firstName,
        middle_name: child.middleName?.trim() || null,
        last_name: child.lastName,
        date_of_birth: child.dateOfBirth,
        place_of_birth: child.placeOfBirth,
        gender: child.gender,
        address: fullAddress,
        post_code: batchBody.postcode,
        home_contact: batchBody.homeTelephone || null,
        mobile_contact: isBoy ? batchBody.fatherMobile : batchBody.motherMobile,
        mother_mobile: batchBody.motherMobile || null,
        mother_name: batchBody.motherName || null,
        guardian_email: batchBody.email,
        guardian_name: batchBody.guardianName,
        ethnic_origin: batchBody.ethnicOrigin || null,
        assigned_group: studentGroup,
        medical_notes: child.medicalNotes?.trim() || null,
        registration_type: "regular",
        status: "awaiting_payment", // New status for tracking
      };

      await supabase
        .from("pending_registrations")
        .insert(pendingData);
    }

    console.log("All students created:", createdStudents.map(s => ({ id: s.id, name: s.name })));

    // Send payment links for each student
    // Pass sibling count so discount can be applied for 3+ children
    const siblingCount = createdStudents.length;
    
    for (const student of createdStudents) {
      try {
        console.log(`Sending payment link for ${student.name} (${student.maktab}), sibling count: ${siblingCount}`);
        
        const paymentResponse = await fetch(`${supabaseUrl}/functions/v1/send-payment-link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            studentId: student.id,
            guardianEmail: batchBody.email,
            studentName: student.name,
            maktab: student.maktab,
            siblingCount: siblingCount, // For sibling discount
          }),
        });

        if (!paymentResponse.ok) {
          const errorText = await paymentResponse.text();
          console.error(`Failed to send payment link for ${student.name}:`, errorText);
        } else {
          console.log(`Payment link sent for ${student.name}`);
        }
      } catch (paymentErr) {
        console.error(`Error sending payment link for ${student.name}:`, paymentErr);
        // Continue with other students even if one fails
      }
    }

    // Send notification emails to admins
    try {
      const boyNames = createdStudents
        .filter(s => s.maktab === "boys")
        .map(s => s.name);
      const girlNames = createdStudents
        .filter(s => s.maktab === "girls")
        .map(s => s.name);

      if (boyNames.length > 0) {
        await fetch(`${supabaseUrl}/functions/v1/notify-new-registration`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            studentName: boyNames.join(", "),
            gender: "Male",
            registrationType: "regular",
            guardianName: batchBody.guardianName,
            guardianEmail: batchBody.email,
            submittedAt: new Date().toISOString(),
            childCount: boyNames.length,
            paymentLinkSent: true,
          }),
        });
        console.log("Boys maktab notification sent");
      }

      if (girlNames.length > 0) {
        await fetch(`${supabaseUrl}/functions/v1/notify-new-registration`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            studentName: girlNames.join(", "),
            gender: "Female",
            registrationType: "regular",
            guardianName: batchBody.guardianName,
            guardianEmail: batchBody.email,
            submittedAt: new Date().toISOString(),
            childCount: girlNames.length,
            paymentLinkSent: true,
          }),
        });
        console.log("Girls maktab notification sent");
      }
    } catch (notifyError) {
      console.error("Error sending admin notification:", notifyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        students: createdStudents.map(s => ({
          id: s.id,
          name: s.name,
          code: s.studentCode,
        })),
        message: `Registration for ${childNames.join(", ")} submitted successfully. Payment link has been sent to ${batchBody.email}.`,
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

// Handle legacy single-child registration format
async function handleLegacyRegistration(
  body: LegacyRegistrationRequest,
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<Response> {
  console.log("Received legacy registration request:", { ...body, email: "***" });

  // Validate required fields
  const requiredFields = [
    "firstName", "lastName", "dateOfBirth", "placeOfBirth", 
    "gender", "address", "townCity", "postcode", 
    "fatherMobile", "email", "guardianName"
  ];
  
  const missingFields = requiredFields.filter(field => !body[field as keyof LegacyRegistrationRequest]);
  if (missingFields.length > 0) {
    console.error("Missing required fields:", missingFields);
    return new Response(
      JSON.stringify({ error: `Missing required fields: ${missingFields.join(", ")}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate gender
  const genderLower = body.gender.toLowerCase();
  if (genderLower !== "male" && genderLower !== "female") {
    return new Response(
      JSON.stringify({ error: "Gender must be 'Male' or 'Female'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Combine address with town/city
  const fullAddress = `${body.address}, ${body.townCity}`;
  const fullName = [body.firstName, body.middleName, body.lastName].filter(Boolean).join(" ");
  const maktab = genderLower === "male" ? "boys" : "girls";

  console.log("Creating student with pending_payment status:", { name: fullName, maktab });

  // Create student record directly with pending_payment status
  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert({
      name: fullName,
      maktab,
      student_group: "A", // Default to Qaidah for legacy
      gender: body.gender,
      date_of_birth: body.dateOfBirth,
      place_of_birth: body.placeOfBirth,
      address: fullAddress,
      post_code: body.postcode,
      home_contact: body.homeTelephone || null,
      mobile_contact: body.fatherMobile,
      guardian_email: body.email,
      guardian_name: body.guardianName,
      ethnic_origin: body.ethnicOrigin || null,
      status: "pending_payment",
      admission_date: new Date().toISOString().split("T")[0],
    })
    .select("id, student_code, name")
    .single();

  if (studentError) {
    console.error("Failed to create student:", studentError);
    return new Response(
      JSON.stringify({ error: "Failed to create student record", details: studentError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("Student created:", { id: student.id, code: student.student_code });

  // Also create pending_registration for audit trail
  await supabase
    .from("pending_registrations")
    .insert({
      first_name: body.firstName,
      middle_name: body.middleName?.trim() || null,
      last_name: body.lastName,
      date_of_birth: body.dateOfBirth,
      place_of_birth: body.placeOfBirth,
      gender: body.gender,
      address: fullAddress,
      post_code: body.postcode,
      home_contact: body.homeTelephone || null,
      mobile_contact: body.fatherMobile,
      guardian_email: body.email,
      guardian_name: body.guardianName,
      ethnic_origin: body.ethnicOrigin || null,
      status: "awaiting_payment",
    });

  // Send payment link
  try {
    console.log(`Sending payment link for ${fullName} (${maktab})`);
    
    const paymentResponse = await fetch(`${supabaseUrl}/functions/v1/send-payment-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        studentId: student.id,
        guardianEmail: body.email,
        studentName: fullName,
        maktab,
      }),
    });

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      console.error("Failed to send payment link:", errorText);
    } else {
      console.log("Payment link sent successfully");
    }
  } catch (paymentErr) {
    console.error("Error sending payment link:", paymentErr);
  }

  // Send admin notification
  try {
    const notificationPayload = {
      studentName: fullName,
      gender: body.gender,
      registrationType: "regular",
      guardianName: body.guardianName,
      guardianEmail: body.email,
      submittedAt: new Date().toISOString(),
      paymentLinkSent: true,
    };
    
    await fetch(`${supabaseUrl}/functions/v1/notify-new-registration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(notificationPayload),
    });
    console.log("Admin notification sent");
  } catch (notifyError) {
    console.error("Error sending admin notification:", notifyError);
  }

  return new Response(
    JSON.stringify({
      success: true,
      student: {
        id: student.id,
        name: fullName,
        code: student.student_code,
      },
      message: `Registration for ${fullName} submitted successfully. Payment link has been sent to ${body.email}.`,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
