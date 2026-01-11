import { format } from "date-fns";

interface AttendanceRecord {
  id: string;
  date: string;
  student_id: string;
  status: string;
  teacher_name: string;
  student_name: string;
}

interface StudentProgress {
  id: string;
  name: string;
  student_group?: string | null;
  qaidah_level?: number | null;
  duas_status?: string | null;
  quran_juz?: number | null;
  quran_completed?: boolean | null;
  tajweed_level?: number | null;
  tajweed_completed?: boolean | null;
  hifz_sabak?: number | null;
  hifz_s_para?: number | null;
  hifz_daur?: number | null;
  hifz_graduated?: boolean | null;
}

interface ExportStats {
  totalRecords: number;
  totalPresent: number;
  totalAbsent: number;
  attendancePercentage: number;
  uniqueStudents: number;
  uniqueDates: number;
  dateRange: string;
  teacher: string;
  student: string;
  maktab: string;
}

const getGroupLabel = (code: string | null | undefined): string => {
  if (!code) return '';
  const labels: Record<string, string> = {
    'A': 'Group A (Qaidah)',
    'B': 'Group B (Quran)',
    'C': 'Group C (Hifz)',
  };
  return labels[code] || `Group ${code}`;
};

const formatProgress = (student: StudentProgress): string[] => {
  const progress: string[] = [];
  const group = student.student_group;

  if (group === 'A') {
    if (student.qaidah_level) progress.push(`Qaidah Level ${student.qaidah_level}`);
    if (student.duas_status) progress.push(`Duas: ${student.duas_status}`);
  } else if (group === 'B') {
    if (student.quran_completed) {
      progress.push('Quran: Completed');
    } else if (student.quran_juz) {
      progress.push(`Quran Juz ${student.quran_juz}`);
    }
    if (student.tajweed_completed) {
      progress.push('Tajweed: Completed');
    } else if (student.tajweed_level) {
      progress.push(`Tajweed Level ${student.tajweed_level}`);
    }
    if (student.duas_status) progress.push(`Duas: ${student.duas_status}`);
  } else if (group === 'C') {
    if (student.hifz_graduated) {
      progress.push('HAFIZ (Graduated)');
    } else {
      if (student.hifz_sabak) progress.push(`Sabak Juz ${student.hifz_sabak}`);
      if (student.hifz_s_para) progress.push(`S.Para Juz ${student.hifz_s_para}`);
      if (student.hifz_daur) progress.push(`Daur Juz ${student.hifz_daur}`);
    }
  }

  return progress;
};

export const generateCSVReport = (
  records: AttendanceRecord[],
  filters: {
    startDate?: string;
    endDate?: string;
    teacher?: string;
    studentId?: string;
    maktab: string;
  },
  students: StudentProgress[]
): string => {
  // Calculate statistics
  const totalPresent = records.filter(r => r.status === "attended").length;
  const totalAbsent = records.filter(r => r.status === "skipped").length;
  const totalRecords = records.length;
  const attendancePercentage = totalRecords > 0 
    ? ((totalPresent / totalRecords) * 100).toFixed(1)
    : "0.0";

  const uniqueStudents = new Set(records.map(r => r.student_id)).size;
  const uniqueDates = new Set(records.map(r => r.date)).size;

  const dateRange = filters.startDate && filters.endDate
    ? `${format(new Date(filters.startDate), "MMM dd, yyyy")} - ${format(new Date(filters.endDate), "MMM dd, yyyy")}`
    : "All Time";

  const teacherFilter = filters.teacher || "All Teachers";
  const studentFilter = filters.studentId 
    ? students.find(s => s.id === filters.studentId)?.name || "Unknown"
    : "All Students";

  // Build CSV content
  let csv = "";
  
  // Header
  csv += `"${filters.maktab.charAt(0).toUpperCase() + filters.maktab.slice(1)} Maktab Attendance Report"\n`;
  csv += `"Generated: ${format(new Date(), "MMM dd, yyyy 'at' hh:mm a")}"\n\n`;

  // Calculate perfect months for individual student
  let perfectMonthsCount = 0;
  if (filters.studentId) {
    const monthlyRecords = new Map<string, { present: number; absent: number }>();
    records.forEach(record => {
      const monthKey = record.date.substring(0, 7); // YYYY-MM format
      if (!monthlyRecords.has(monthKey)) {
        monthlyRecords.set(monthKey, { present: 0, absent: 0 });
      }
      const monthStats = monthlyRecords.get(monthKey)!;
      if (record.status === "attended") {
        monthStats.present++;
      } else {
        monthStats.absent++;
      }
    });
    monthlyRecords.forEach((monthData) => {
      if (monthData.present > 0 && monthData.absent === 0) {
        perfectMonthsCount++;
      }
    });
  }

  // Statistics Section
  csv += "SUMMARY STATISTICS\n";
  csv += `"Date Range","${dateRange}"\n`;
  csv += `"Teacher Filter","${teacherFilter}"\n`;
  csv += `"Student Filter","${studentFilter}"\n`;
  csv += `"Total Records","${totalRecords}"\n`;
  csv += `"Total Present","${totalPresent}"\n`;
  csv += `"Total Absent","${totalAbsent}"\n`;
  csv += `"Attendance Rate","${attendancePercentage}%"\n`;
  if (filters.studentId) {
    csv += `"Perfect Attendance Months","${perfectMonthsCount}"\n`;
  }
  csv += `"Unique Students","${uniqueStudents}"\n`;
  csv += `"Unique Dates","${uniqueDates}"\n\n`;

  // Per-Student Statistics with Progress
  if (!filters.studentId) {
    csv += "PER-STUDENT STATISTICS & PROGRESS\n";
    csv += `"Student Name","Group","Total Present","Total Absent","Attendance %","Perfect Months","Current Progress"\n`;
    
    const studentStats = new Map<string, { 
      present: number; 
      absent: number; 
      name: string; 
      studentData?: StudentProgress;
      monthlyRecords: Map<string, { present: number; absent: number }>;
    }>();
    
    records.forEach(record => {
      if (!studentStats.has(record.student_id)) {
        const studentData = students.find(s => s.id === record.student_id);
        studentStats.set(record.student_id, {
          present: 0,
          absent: 0,
          name: record.student_name || "Unknown",
          studentData,
          monthlyRecords: new Map()
        });
      }
      
      const stats = studentStats.get(record.student_id)!;
      const monthKey = record.date.substring(0, 7); // YYYY-MM format
      
      if (!stats.monthlyRecords.has(monthKey)) {
        stats.monthlyRecords.set(monthKey, { present: 0, absent: 0 });
      }
      
      const monthStats = stats.monthlyRecords.get(monthKey)!;
      
      if (record.status === "attended") {
        stats.present++;
        monthStats.present++;
      } else {
        stats.absent++;
        monthStats.absent++;
      }
    });

    Array.from(studentStats.entries())
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .forEach(([_, stats]) => {
        const total = stats.present + stats.absent;
        const percentage = total > 0 ? ((stats.present / total) * 100).toFixed(1) : "0.0";
        const group = stats.studentData ? getGroupLabel(stats.studentData.student_group) : '';
        const progress = stats.studentData ? formatProgress(stats.studentData).join('; ') : '';
        
        // Calculate perfect attendance months (100% present, at least 1 record in month)
        let perfectMonths = 0;
        stats.monthlyRecords.forEach((monthData) => {
          if (monthData.present > 0 && monthData.absent === 0) {
            perfectMonths++;
          }
        });
        
        csv += `"${stats.name}","${group}","${stats.present}","${stats.absent}","${percentage}%","${perfectMonths}","${progress}"\n`;
      });
    
    csv += "\n";
  }

  // Student Progress Summary Section
  csv += "STUDENT PROGRESS OVERVIEW\n";
  csv += `"Student Name","Group","Qaidah","Duas","Quran","Tajweed","Hifz Sabak","Hifz S.Para","Hifz Daur","Graduated"\n`;
  
  // Get unique students from records
  const recordStudentIds = new Set(records.map(r => r.student_id));
  const relevantStudents = students.filter(s => recordStudentIds.has(s.id));
  
  relevantStudents
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(student => {
      const group = student.student_group || '';
      const qaidah = student.qaidah_level ? `Level ${student.qaidah_level}` : '';
      const duas = student.duas_status || '';
      const quran = student.quran_completed ? 'Completed' : (student.quran_juz ? `Juz ${student.quran_juz}` : '');
      const tajweed = student.tajweed_completed ? 'Completed' : (student.tajweed_level ? `Level ${student.tajweed_level}` : '');
      const sabak = student.hifz_sabak ? `Juz ${student.hifz_sabak}` : '';
      const spara = student.hifz_s_para ? `Juz ${student.hifz_s_para}` : '';
      const daur = student.hifz_graduated ? 'Hafiz' : (student.hifz_daur ? `Juz ${student.hifz_daur}` : '');
      const graduated = student.hifz_graduated ? 'Yes' : '';
      
      csv += `"${student.name}","Group ${group}","${qaidah}","${duas}","${quran}","${tajweed}","${sabak}","${spara}","${daur}","${graduated}"\n`;
    });
  
  csv += "\n";

  // Detailed Records
  csv += "DETAILED ATTENDANCE RECORDS\n";
  csv += `"Date","Student Name","Group","Status","Teacher"\n`;
  
  // Create a map for quick student lookup
  const studentMap = new Map(students.map(s => [s.id, s]));
  
  records
    .sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return (a.student_name || "").localeCompare(b.student_name || "");
    })
    .forEach(record => {
      const studentName = record.student_name || "Unknown";
      const studentData = studentMap.get(record.student_id);
      const group = studentData?.student_group ? `Group ${studentData.student_group}` : '';
      const status = record.status === "attended" ? "Present" : "Absent";
      const formattedDate = format(new Date(record.date), "MMM dd, yyyy");
      
      csv += `"${formattedDate}","${studentName}","${group}","${status}","${record.teacher_name}"\n`;
    });

  return csv;
};

export const downloadCSV = (csvContent: string, filename: string) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

// Teacher Attendance CSV Export
export interface TeacherAttendanceData {
  teacherName: string;
  maktab: string;
  dates: Date[];
  absentDates: Date[];
  daysCount: number;
}

export interface TeacherNote {
  id: string;
  teacher_name: string;
  maktab: string;
  date: string;
  note: string;
  note_type: string;
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  leave: "Leave",
  sickness: "Sickness",
  other: "Note",
};

export const generateTeacherAttendanceCSV = (
  teachers: TeacherAttendanceData[],
  selectedMonth: Date,
  maktabFilter: "all" | "boys" | "girls",
  notes: TeacherNote[] = []
): string => {
  let csv = "";
  
  // Header
  csv += `"TEACHER ATTENDANCE REPORT"\n`;
  csv += `"Generated: ${format(new Date(), "MMM dd, yyyy 'at' hh:mm a")}"\n`;
  csv += `"Month: ${format(selectedMonth, "MMMM yyyy")}"\n`;
  csv += `"Maktab Filter: ${maktabFilter === "all" ? "All" : maktabFilter.charAt(0).toUpperCase() + maktabFilter.slice(1)}"\n\n`;
  
  // Summary
  const totalDays = teachers.reduce((sum, t) => sum + t.daysCount, 0);
  const avgDays = teachers.length > 0 ? (totalDays / teachers.length).toFixed(1) : "0";
  
  csv += "SUMMARY\n";
  csv += `"Total Teachers","${teachers.length}"\n`;
  csv += `"Total Teaching Days","${totalDays}"\n`;
  csv += `"Average Days per Teacher","${avgDays}"\n`;
  csv += `"Total Notes/Leave/Sickness","${notes.length}"\n\n`;
  
  // Per-Teacher Statistics
  csv += "PER-TEACHER STATISTICS\n";
  csv += `"Teacher Name","Maktab","Days Taught","Leave Days","Sick Days","Dates"\n`;
  
  teachers.forEach((teacher) => {
    const teacherNotes = notes.filter(n => n.teacher_name === teacher.teacherName && n.maktab === teacher.maktab);
    const leaveDays = teacherNotes.filter(n => n.note_type === "leave").length;
    const sickDays = teacherNotes.filter(n => n.note_type === "sickness").length;
    const sortedDates = teacher.dates
      .sort((a, b) => a.getTime() - b.getTime())
      .map((d) => format(d, "MMM d"))
      .join(", ");
    csv += `"${teacher.teacherName}","${teacher.maktab}","${teacher.daysCount}","${leaveDays}","${sickDays}","${sortedDates}"\n`;
  });
  
  csv += "\n";
  
  // Teacher Notes Section
  if (notes.length > 0) {
    csv += "TEACHER NOTES\n";
    csv += `"Date","Teacher","Maktab","Type","Note"\n`;
    
    notes
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((note) => {
        const typeLabel = NOTE_TYPE_LABELS[note.note_type] || "Note";
        const noteText = note.note ? note.note.replace(/"/g, '""') : typeLabel;
        csv += `"${format(new Date(note.date), "MMM dd, yyyy")}","${note.teacher_name}","${note.maktab}","${typeLabel}","${noteText}"\n`;
      });
    
    csv += "\n";
  }
  
  // Detailed Teaching Log
  csv += "DETAILED TEACHING LOG\n";
  csv += `"Date","Teacher","Maktab"\n`;
  
  const allRecords: { date: Date; teacherName: string; maktab: string }[] = [];
  teachers.forEach((teacher) => {
    teacher.dates.forEach((date) => {
      allRecords.push({ date, teacherName: teacher.teacherName, maktab: teacher.maktab });
    });
  });
  
  allRecords
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((record) => {
      csv += `"${format(record.date, "MMM dd, yyyy")}","${record.teacherName}","${record.maktab}"\n`;
    });
  
  return csv;
};
