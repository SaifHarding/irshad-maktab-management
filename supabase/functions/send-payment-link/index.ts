import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface StudentInfo {
  studentId: string;
  studentName: string;
}

interface PaymentLinkRequest {
  // Single student (backwards compatible)
  studentId?: string;
  studentName?: string;
  // Multiple students (new)
  students?: StudentInfo[];
  // Common fields
  guardianEmail: string;
  maktab: "boys" | "girls";
  siblingCount?: number; // For sibling discount (3+ children)
  hasOtherMaktabRegistration?: boolean; // Whether they also registered for the other maktab
}

// Sibling discount configuration
const SIBLING_DISCOUNT_THRESHOLD = 3; // Minimum children to qualify
const SIBLING_DISCOUNT_AMOUNT = 2000; // £20 in pence
const SIBLING_DISCOUNT_MONTHS = 60; // Duration in months

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody: PaymentLinkRequest = await req.json();
    const { guardianEmail, maktab, siblingCount, hasOtherMaktabRegistration } = requestBody;

    // Normalize to array of students (support both old single-student and new multi-student format)
    let students: StudentInfo[];
    if (requestBody.students && requestBody.students.length > 0) {
      students = requestBody.students;
    } else if (requestBody.studentId && requestBody.studentName) {
      students = [{ studentId: requestBody.studentId, studentName: requestBody.studentName }];
    } else {
      return new Response(JSON.stringify({ error: "Missing student information" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentNames = students.map(s => s.studentName).join(", ");
    console.log(`Creating combined payment link for ${students.length} student(s): ${studentNames} in ${maktab} maktab, siblings: ${siblingCount || students.length}`);

    if (!guardianEmail || !maktab) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the appropriate Stripe keys and price IDs based on maktab
    const stripeSecretKey = maktab === "boys"
      ? Deno.env.get("STRIPE_SECRET_KEY_BOYS")
      : Deno.env.get("STRIPE_SECRET_KEY_GIRLS");

    const admissionPriceId = maktab === "boys"
      ? Deno.env.get("STRIPE_ADMISSION_PRICE_ID_BOYS")
      : Deno.env.get("STRIPE_ADMISSION_PRICE_ID_GIRLS");

    const subscriptionPriceId = maktab === "boys"
      ? Deno.env.get("STRIPE_SUBSCRIPTION_PRICE_ID_BOYS")
      : Deno.env.get("STRIPE_SUBSCRIPTION_PRICE_ID_GIRLS");

    if (!stripeSecretKey || !admissionPriceId || !subscriptionPriceId) {
      console.error(`Missing Stripe configuration for ${maktab}`);
      return new Response(JSON.stringify({ error: "Missing Stripe configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({
      email: guardianEmail.toLowerCase(),
      limit: 1,
    });

    let customerId: string;

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
      console.log(`Found existing customer: ${customerId}`);
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: guardianEmail.toLowerCase(),
        name: studentNames,
        metadata: {
          student_ids: students.map(s => s.studentId).join(","),
          maktab: maktab,
        },
      });
      customerId = customer.id;
      console.log(`Created new customer: ${customerId}`);
    }

    // Update all students with stripe_customer_id
    for (const student of students) {
      await supabase
        .from("students")
        .update({ stripe_customer_id: customerId })
        .eq("id", student.studentId);
    }

    // Calculate total sibling count for discount purposes
    const totalSiblings = siblingCount || students.length;
    const qualifiesForSiblingDiscount = totalSiblings >= SIBLING_DISCOUNT_THRESHOLD;

    // Check if sibling discount should be applied (3+ children)
    let discounts: { coupon: string }[] | undefined = undefined;

    if (qualifiesForSiblingDiscount) {
      console.log(`Applying sibling discount for ${totalSiblings} children`);
      
      // Try to find or create the sibling discount coupon
      const couponId = `sibling_discount_${maktab}`;
      
      try {
        // Check if coupon exists
        await stripe.coupons.retrieve(couponId);
        console.log(`Found existing sibling discount coupon: ${couponId}`);
      } catch {
        // Coupon doesn't exist, create it
        console.log(`Creating sibling discount coupon: ${couponId}`);
        await stripe.coupons.create({
          id: couponId,
          amount_off: SIBLING_DISCOUNT_AMOUNT, // £20 in pence
          currency: "gbp",
          duration: "repeating",
          duration_in_months: SIBLING_DISCOUNT_MONTHS, // 60 months
          name: `Sibling Discount - £20 off`, // Max 40 chars for Stripe
          metadata: {
            maktab: maktab,
            min_children: String(SIBLING_DISCOUNT_THRESHOLD),
          },
        });
        console.log(`Created sibling discount coupon: ${couponId}`);
      }
      
      discounts = [{ coupon: couponId }];
    }

    // Build line items - use quantity for multiple students
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      // Admission fee (one-time) - quantity = number of students
      {
        price: admissionPriceId,
        quantity: students.length,
      },
      // Subscription (recurring) - quantity = number of students
      {
        price: subscriptionPriceId,
        quantity: students.length,
      },
    ];

    // Create checkout session with all products
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "subscription", // subscription mode allows one-time + recurring
      allow_promotion_codes: discounts ? false : true, // Disable promo codes if discount already applied
      success_url: `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '')}.lovable.app/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '')}.lovable.app/payment-cancelled`,
      metadata: {
        student_ids: students.map(s => s.studentId).join(","),
        student_names: studentNames,
        maktab: maktab,
        sibling_discount_applied: qualifiesForSiblingDiscount ? "true" : "false",
      },
      customer_update: {
        address: "auto",
      },
      billing_address_collection: "required",
    };

    // Add discounts if sibling discount applies
    if (discounts) {
      sessionParams.discounts = discounts;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`Created checkout session: ${session.id}`);

    // Send email with payment link
    if (RESEND_API_KEY) {
      const maktabLabel = maktab === "boys" ? "Boys Maktab" : "Girls Maktab";
      const otherMaktabLabel = maktab === "boys" ? "Girls Maktab" : "Boys Maktab";
      
      // Build student list for email
      const studentListHtml = students.length > 1
        ? `<ul style="margin: 10px 0; padding-left: 20px;">
            ${students.map(s => `<li><strong>${s.studentName}</strong></li>`).join("")}
           </ul>`
        : `<strong>${students[0].studentName}</strong>`;

      const studentText = students.length > 1 
        ? `your ${students.length} children` 
        : `<strong>${students[0].studentName}</strong>`;
      
      // Build sibling discount message if applicable
      const siblingDiscountMessage = qualifiesForSiblingDiscount
        ? `
              <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 15px; margin: 20px 0;">
                <p style="color: #155724; margin: 0; font-weight: bold;">🎉 Sibling Discount Applied!</p>
                <p style="color: #155724; margin: 5px 0 0 0; font-size: 14px;">
                  As you are registering ${totalSiblings} children, a £20/month discount has been automatically applied to each child's subscription for 60 months.
                </p>
              </div>
            `
        : "";

      // Build other maktab notice only if they have registrations in the other maktab
      const otherMaktabNotice = hasOtherMaktabRegistration
        ? `
              <div style="background-color: #e8f4fd; border: 1px solid #bee3f8; border-radius: 6px; padding: 15px; margin: 20px 0;">
                <p style="color: #2b6cb0; margin: 0; font-size: 14px;">
                  <strong>Please note:</strong> You will receive a separate payment email for your child(ren) registered in the ${otherMaktabLabel}.
                </p>
              </div>
            `
        : "";

      // Build payment summary
      const paymentSummary = students.length > 1
        ? `
              <h3 style="color: #2d3748;">Payment includes (for ${students.length} children):</h3>
              <ul>
                <li><strong>${students.length}x Admission Fee</strong> (one-time)</li>
                <li><strong>${students.length}x Monthly Classes</strong> (subscription)${qualifiesForSiblingDiscount ? " - £20/month discount applied per child" : ""}</li>
              </ul>
            `
        : `
              <h3 style="color: #2d3748;">Payment includes:</h3>
              <ul>
                <li><strong>Admission Fee</strong> (one-time)</li>
                <li><strong>Monthly Classes</strong> (subscription)${qualifiesForSiblingDiscount ? " - £20/month discount applied" : ""}</li>
              </ul>
            `;
      
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Masjid Irshad Maktab <noreply@masjidirshad.co.uk>",
          to: [guardianEmail],
          subject: `Complete Payment - ${maktabLabel}${students.length > 1 ? ` (${students.length} children)` : ` - ${students[0].studentName}`}${qualifiesForSiblingDiscount ? " (Sibling Discount Applied)" : ""}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a365d;">Assalamu Alaikum,</h2>
              
              <p>Thank you for registering ${studentText} at the ${maktabLabel}.</p>
              
              ${students.length > 1 ? `<p>The following children are included in this registration:</p>${studentListHtml}` : ""}
              
              <p>To complete ${students.length > 1 ? "their" : "your child's"} registration, please complete the payment below to finalise ${students.length > 1 ? "their" : "their"} enrolment.</p>
              ${siblingDiscountMessage}
              ${paymentSummary}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${session.url}" 
                   style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Complete Payment
                </a>
              </div>
              ${otherMaktabNotice}
              <p style="color: #718096; font-size: 14px;">
                This link will expire in 24 hours.
              </p>
              
              <div style="background-color: #f7fafc; border-radius: 6px; padding: 15px; margin: 20px 0;">
                <p style="color: #4a5568; margin: 0 0 5px 0; font-weight: bold;">Need help?</p>
                <p style="color: #718096; margin: 0; font-size: 14px;">
                  For any questions or technical support, please contact:<br/>
                  <strong>${maktab === "boys" ? "Maulana Zubair" : "Ustadha Nurulain"}</strong> via WhatsApp: 
                  <a href="https://wa.me/${maktab === "boys" ? "447843804376" : "447379679862"}" style="color: #2563eb;">${maktab === "boys" ? "07843 804376" : "07379 679862"}</a>
                </p>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
              
              <p style="color: #a0aec0; font-size: 12px;">
                Masjid Irshad Maktab<br/>
                This is an automated message, please do not reply.
              </p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const emailError = await emailRes.text();
        console.error("Failed to send email:", emailError);
      } else {
        console.log("Payment link email sent successfully");
      }
    } else {
      console.warn("RESEND_API_KEY not configured, skipping email");
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        customerId: customerId,
        studentCount: students.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating payment link:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});