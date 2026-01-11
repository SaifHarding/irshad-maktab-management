import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@3.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StudentAttendance {
  id: string;
  name: string;
  totalPresent: number;
  totalAbsent: number;
  totalRecords: number;
  attendancePercentage: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting attendance report generation...");

    // Get maktab from request body
    const { maktab = 'girls' } = await req.json().catch(() => ({ maktab: 'girls' }));
    console.log('Generating report for maktab:', maktab);

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    // Fetch all students for this maktab
    console.log('Fetching students...');
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name')
      .eq('maktab', maktab)
      .order('name', { ascending: true });

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      throw studentsError;
    }

    console.log(`Found ${students?.length || 0} students`);

    // Fetch all attendance records for this maktab
    console.log('Fetching attendance records...');
    const { data: records, error: recordsError } = await supabase
      .from('attendance_records')
      .select('student_id, status')
      .eq('maktab', maktab);

    if (recordsError) {
      console.error('Error fetching records:', recordsError);
      throw recordsError;
    }

    console.log(`Found ${records?.length || 0} attendance records`);

    // Calculate attendance percentages for each student
    const studentAttendance: StudentAttendance[] = [];

    students?.forEach(student => {
      const studentRecords = records?.filter(r => r.student_id === student.id) || [];
      const totalPresent = studentRecords.filter(r => r.status === 'attended').length;
      const totalAbsent = studentRecords.filter(r => r.status === 'skipped').length;
      const totalRecords = studentRecords.length;
      const attendancePercentage = totalRecords > 0 
        ? (totalPresent / totalRecords) * 100 
        : 0;

      studentAttendance.push({
        id: student.id,
        name: student.name,
        totalPresent,
        totalAbsent,
        totalRecords,
        attendancePercentage: parseFloat(attendancePercentage.toFixed(2))
      });
    });

    // Filter students with under 60% attendance
    const lowAttendanceStudents = studentAttendance.filter(s => s.attendancePercentage < 60);
    
    // Filter students with 100% attendance (must have at least 1 record)
    const perfectAttendanceStudents = studentAttendance.filter(s => s.attendancePercentage === 100 && s.totalRecords > 0);
    
    console.log(`Found ${lowAttendanceStudents.length} students with under 60% attendance`);
    console.log(`Found ${perfectAttendanceStudents.length} students with 100% attendance`);

    // Generate CSV content with ALL students
    let csvContent = "Student Name,Total Present,Total Absent,Total Records,Attendance %\n";
    
    studentAttendance
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(student => {
        csvContent += `"${student.name}",${student.totalPresent},${student.totalAbsent},${student.totalRecords},${student.attendancePercentage}%\n`;
      });

    // Convert CSV to base64 for attachment
    const csvBase64 = btoa(csvContent);

    // Get head teacher email from profiles
    const { data: headTeacher } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('maktab', maktab)
      .eq('is_head_teacher', true)
      .maybeSingle();
    
    const recipientEmail = headTeacher?.email;
    
    if (!recipientEmail) {
      console.log(`No head teacher email configured for ${maktab} maktab`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No head teacher email configured for ${maktab} maktab. Please add an email to the head teacher in User Management.`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const maktabName = maktab.charAt(0).toUpperCase() + maktab.slice(1);

    console.log(`Sending email to ${recipientEmail}...`);

    // Build email subject based on content
    const hasLowAttendance = lowAttendanceStudents.length > 0;
    const hasPerfectAttendance = perfectAttendanceStudents.length > 0;
    
    let emailSubject = `${maktabName} Maktab - Monthly Attendance Report`;
    if (hasLowAttendance && hasPerfectAttendance) {
      emailSubject = `${maktabName} Maktab - Attendance Report (${perfectAttendanceStudents.length} Perfect, ${lowAttendanceStudents.length} Low)`;
    } else if (hasLowAttendance) {
      emailSubject = `${maktabName} Maktab - Low Attendance Alert (${lowAttendanceStudents.length} students)`;
    } else if (hasPerfectAttendance) {
      emailSubject = `${maktabName} Maktab - Perfect Attendance Report (${perfectAttendanceStudents.length} students)`;
    }

    // Send email with CSV attachment
    const emailResponse = await resend.emails.send({
      from: 'Maktab Attendance <noreply@masjidirshad.co.uk>',
      to: [recipientEmail],
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Monthly Attendance Report - ${maktabName} Maktab</h2>
          
          <p>As-salamu alaykum,</p>
          
          <p>This is your monthly attendance report. A CSV file with complete attendance statistics for all ${studentAttendance.length} students is attached to this email.</p>
          
          <div style="background-color: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px; margin: 20px 0;">
            <strong>📊 Total Students:</strong> ${studentAttendance.length}
          </div>
          
          <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
            <strong>🌟 Perfect Attendance:</strong> ${perfectAttendanceStudents.length} student(s) with 100% attendance
          </div>
          
          ${lowAttendanceStudents.length > 0 ? `
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <strong>⚠️ Low Attendance:</strong> ${lowAttendanceStudents.length} student(s) with attendance under 60%
          </div>
          ` : ''}
          
          ${perfectAttendanceStudents.length > 0 ? `
          <h3 style="color: #2e7d32;">🏆 Students with Perfect Attendance (100%)</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #e8f5e9;">
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Student Name</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Days Present</th>
              </tr>
            </thead>
            <tbody>
              ${perfectAttendanceStudents
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(student => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 12px;">${student.name}</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #c8e6c9; color: #1b5e20; font-weight: bold;">${student.totalPresent} days</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
          ` : ''}
          
          ${lowAttendanceStudents.length > 0 ? `
          <h3 style="color: #d32f2f;">Students Requiring Attention (Under 60%)</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Student Name</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Attendance %</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Present</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Absent</th>
              </tr>
            </thead>
            <tbody>
              ${lowAttendanceStudents
                .sort((a, b) => a.attendancePercentage - b.attendancePercentage)
                .map(student => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 12px;">${student.name}</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center; ${
                      student.attendancePercentage < 40 ? 'background-color: #ffebee; color: #c62828; font-weight: bold;' : 
                      student.attendancePercentage < 50 ? 'background-color: #fff3e0; color: #ef6c00;' : 
                      'background-color: #fffde7; color: #f57f17;'
                    }">${student.attendancePercentage}%</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${student.totalPresent}</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${student.totalAbsent}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
          ` : ''}
          
          <p style="margin-top: 20px; background-color: #f5f5f5; padding: 15px; border-radius: 4px;">
            <strong>📎 Attachment:</strong> The attached CSV file contains complete attendance statistics for all students including: name, days present, days absent, total records, and attendance percentage.
          </p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px;">
            This is an automated report from the Maktab Attendance System.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `attendance-report-${maktab}-${new Date().toISOString().split('T')[0]}.csv`,
          content: csvBase64,
        },
      ],
    });

    console.log('Email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Report sent to ${recipientEmail}`,
        count: lowAttendanceStudents.length,
        emailId: emailResponse.data?.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-attendance-report function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
