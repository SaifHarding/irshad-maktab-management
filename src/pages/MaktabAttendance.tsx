import { useState, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import TeacherSelect from "@/components/TeacherSelect";
import AttendanceCard from "@/components/AttendanceCard";
import AttendanceSummary from "@/components/AttendanceSummary";
import SuccessScreen from "@/components/SuccessScreen";
import GhostModeBanner from "@/components/GhostModeBanner";
import { ProgressPromptDialog, StudentProgress } from "@/components/progress/ProgressPromptDialog";
import { useStudents, Student } from "@/hooks/useStudents";
import { useAttendance } from "@/hooks/useAttendance";
import { useDeleteStudent } from "@/hooks/useDeleteStudent";
import { useStudentProgress } from "@/hooks/useStudentProgress";
import { useProgressPrompt } from "@/hooks/useProgressPrompt";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getGroupLabel, getGroupCodesForMaktab, GroupCode } from "@/lib/groups";
import { paths } from "@/lib/portalPaths";

type Screen = "teacher" | "attendance" | "progress" | "summary" | "success";

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: "attended" | "skipped";
}

const MaktabAttendance = () => {
  const navigate = useNavigate();
  const { maktab } = useParams<{ maktab: "boys" | "girls" }>();
  
  if (maktab !== "boys" && maktab !== "girls") {
    return <Navigate to={paths.home()} replace />;
  }

  // Apply pink theme to girls maktab
  useEffect(() => {
    if (maktab === "girls") {
      document.documentElement.setAttribute("data-theme", "pink");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [maktab]);

  const [currentScreen, setCurrentScreen] = useState<Screen>("teacher");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<GroupCode[]>([]);
  const [sessionDate] = useState(new Date());
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [progressStudent, setProgressStudent] = useState<Student | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [skipProgressForSession, setSkipProgressForSession] = useState(false);
  const [isFirstProgressPrompt, setIsFirstProgressPrompt] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // For filtering students - use selected groups from TeacherSelect
  const filterGroup = selectedGroups.length === 1 ? selectedGroups[0] : undefined;
  const filterGroups = selectedGroups.length > 1 ? selectedGroups : undefined;
  
  const { students, isLoading, addStudent, isAdding } = useStudents(
    currentScreen !== "teacher" && selectedGroups.length > 0, 
    maktab, 
    filterGroup,
    filterGroups
  );
  const { submitAttendance, isSubmitting } = useAttendance(maktab);
  const { deleteStudent } = useDeleteStudent();
  const { updateProgress, graduateStudent, isUpdating, isGraduating } = useStudentProgress(maktab, filterGroup);
  const queryClient = useQueryClient();
  
  // Progress prompt logic
  const { shouldShowPrompt, getCurrentMonth } = useProgressPrompt({ 
    maktab: maktab!, 
    student: progressStudent 
  });

  useEffect(() => {
    checkAccess();
  }, [maktab]);

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate(paths.auth());
      return;
    }

    // Get user's profile and roles
    const { data: profile } = await supabase
      .from("profiles")
      .select("maktab")
      .eq("id", user.id)
      .single();

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = roles?.map(r => r.role) || [];
    const hasAdminRole = userRoles.includes("admin");
    const hasTeacherRole = userRoles.includes("teacher");
    
    setIsAdmin(hasAdminRole);

    // If user is ONLY a teacher (not also admin), verify they can access this maktab
    if (hasTeacherRole && !hasAdminRole) {
      if (!profile?.maktab) {
        toast({
          title: "Access Denied",
          description: "No maktab assigned to your account",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      
      if (profile.maktab !== maktab) {
        toast({
          title: "Access Denied",
          description: `You can only access ${profile.maktab} maktab`,
          variant: "destructive",
        });
        navigate(`/${profile.maktab}`);
        return;
      }
    }

    setCheckingAccess(false);
  };


  const handleTeacherSelect = (teacher: string, groups: GroupCode[]) => {
    setSelectedTeacher(teacher);
    setSelectedGroups(groups);
    // Force refresh student data to get latest progress state
    queryClient.invalidateQueries({ queryKey: ["students", maktab] });
    setCurrentScreen("attendance");
  };


  // Helper function to check if progress prompt should show for a student
  const shouldShowProgressPrompt = (student: Student): boolean => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayOfMonth = today.getDate();
    const currentMonth = format(today, "yyyy-MM");

    // Already recorded progress this month
    if (student.last_progress_month === currentMonth) return false;

    // No group assigned - don't show prompt
    if (!student.student_group) return false;

    // December 2024 special rules
    if (currentMonth === "2024-12") {
      if (maktab === "girls") {
        // Girls: Dec 9th onwards, only Tue/Wed
        return dayOfMonth >= 9 && (dayOfWeek === 2 || dayOfWeek === 3);
      } else {
        // Boys: Dec 8th onwards, Mon-Thu
        return dayOfMonth >= 8 && dayOfWeek >= 1 && dayOfWeek <= 4;
      }
    }

    // Normal monthly rules
    if (maktab === "girls") {
      // Girls: Tuesday (2) or Wednesday (3)
      return dayOfWeek === 2 || dayOfWeek === 3;
    } else {
      // Boys: Monday (1) through Thursday (4)
      return dayOfWeek >= 1 && dayOfWeek <= 4;
    }
  };

  const handleMarkAttendance = (status: "attended" | "skipped") => {
    const currentStudent = students[currentStudentIndex];
    const newRecord: AttendanceRecord = {
      studentId: currentStudent.id,
      studentName: currentStudent.name,
      status,
    };

    setAttendanceRecords([...attendanceRecords, newRecord]);

    // If marked present and not skipping progress for session, check if we should show progress prompt
    if (status === "attended" && !skipProgressForSession && shouldShowProgressPrompt(currentStudent)) {
      setProgressStudent(currentStudent);
      setShowProgressDialog(true);
      return; // Wait for dialog to close before proceeding
    }

    // Always proceed if no dialog needed
    moveToNextStudentOrSummary();
  };

  const moveToNextStudentOrSummary = () => {
    if (currentStudentIndex < students.length - 1) {
      setCurrentStudentIndex(currentStudentIndex + 1);
    } else {
      setCurrentScreen("summary");
    }
  };

  const handleProgressSubmitGroupA = (data: { qaidah_level: number; duas_status: string }) => {
    if (!progressStudent) return;
    updateProgress({
      studentId: progressStudent.id,
      updates: {
        qaidah_level: data.qaidah_level,
        duas_status: data.duas_status,
        last_progress_month: getCurrentMonth(),
      },
      createSnapshot: true,
    }, {
      onSuccess: () => {
        setShowProgressDialog(false);
        setProgressStudent(null);
        setIsFirstProgressPrompt(false);
        moveToNextStudentOrSummary();
      },
    });
  };

  const handleProgressSubmitGroupB = (data: {
    quran_juz: number | null;
    quran_completed: boolean;
    tajweed_level: number | null;
    tajweed_completed: boolean;
    duas_status: string;
  }) => {
    if (!progressStudent) return;
    updateProgress({
      studentId: progressStudent.id,
      updates: {
        quran_juz: data.quran_juz,
        quran_completed: data.quran_completed,
        tajweed_level: data.tajweed_level,
        tajweed_completed: data.tajweed_completed,
        duas_status: data.duas_status,
        last_progress_month: getCurrentMonth(),
      },
      createSnapshot: true,
    }, {
      onSuccess: () => {
        setShowProgressDialog(false);
        setProgressStudent(null);
        setIsFirstProgressPrompt(false);
        moveToNextStudentOrSummary();
      },
    });
  };

  const handleProgressSubmitGroupC = (data: {
    hifz_sabak: number;
    hifz_s_para: number;
    hifz_daur: number | null;
    hifz_graduated: boolean;
  }) => {
    if (!progressStudent) return;
    updateProgress({
      studentId: progressStudent.id,
      updates: {
        hifz_sabak: data.hifz_sabak,
        hifz_s_para: data.hifz_s_para,
        hifz_daur: data.hifz_daur,
        hifz_graduated: data.hifz_graduated,
        last_progress_month: getCurrentMonth(),
      },
      createSnapshot: true,
    }, {
      onSuccess: () => {
        setShowProgressDialog(false);
        setProgressStudent(null);
        setIsFirstProgressPrompt(false);
        moveToNextStudentOrSummary();
      },
    });
  };

  const handleGraduateAtoB = () => {
    if (!progressStudent) return;
    graduateStudent({
      studentId: progressStudent.id,
      fromGroup: "A",
      toGroup: "B",
    }, {
      onSuccess: () => {
        setShowProgressDialog(false);
        setProgressStudent(null);
        setIsFirstProgressPrompt(false);
        moveToNextStudentOrSummary();
      },
    });
  };

  const handleGraduateBtoC = () => {
    if (!progressStudent) return;
    // Only boys can graduate to Hifz (Group C)
    graduateStudent({
      studentId: progressStudent.id,
      fromGroup: "B",
      toGroup: "C",
      assignedTeacher: "Ml Aazib", // Hifz teacher for boys
    }, {
      onSuccess: () => {
        setShowProgressDialog(false);
        setProgressStudent(null);
        setIsFirstProgressPrompt(false);
        moveToNextStudentOrSummary();
      },
    });
  };

  const handleProgressSkip = () => {
    setShowProgressDialog(false);
    setProgressStudent(null);
    setIsFirstProgressPrompt(false);
    // Delay to allow UI to reset before moving to next student
    setTimeout(() => {
      moveToNextStudentOrSummary();
    }, 50);
  };

  const handleSkipClassToday = () => {
    setSkipProgressForSession(true);
    setShowProgressDialog(false);
    setProgressStudent(null);
    moveToNextStudentOrSummary();
  };

  const handleToggleStatus = (studentId: string) => {
    setAttendanceRecords(
      attendanceRecords.map((record) =>
        record.studentId === studentId
          ? {
              ...record,
              status: record.status === "attended" ? "skipped" : "attended",
            }
          : record
      )
    );
  };


  const handleCompleteAttendance = () => {
    const records = attendanceRecords.map((record) => ({
      student_id: record.studentId,
      status: record.status,
      teacher_name: selectedTeacher,
      date: sessionDate.toISOString().split("T")[0],
      maktab: maktab,
    }));

    submitAttendance({ records, forceUpdate: true }, {
      onSuccess: () => {
        setCurrentScreen("success");
      },
    });
  };

  const handleStartNewSession = () => {
    setCurrentScreen("teacher");
    setSelectedTeacher("");
    setCurrentStudentIndex(0);
    setAttendanceRecords([]);
    setSkipProgressForSession(false);
    setIsFirstProgressPrompt(true);
  };

  const handleCancelAttendance = () => {
    setCurrentScreen("teacher");
    setSelectedTeacher("");
    setCurrentStudentIndex(0);
    setAttendanceRecords([]);
    setSkipProgressForSession(false);
    setIsFirstProgressPrompt(true);
  };

  const handleGoBack = () => {
    if (currentStudentIndex > 0) {
      // Remove the last attendance record (for the previous student)
      setAttendanceRecords(attendanceRecords.slice(0, -1));
      setCurrentStudentIndex(currentStudentIndex - 1);
    }
  };

  const handleRemoveStudent = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    deleteStudent({ 
      id: studentId, 
      studentCode: student?.student_code || null, 
      maktab: maktab! 
    });
    
    if (currentStudentIndex < students.length - 1) {
      setCurrentStudentIndex(currentStudentIndex);
    } else {
      setCurrentScreen("summary");
    }
  };

  const handleReassignStudent = async (studentId: string, newGroup: string) => {
    const { error } = await supabase
      .from("students")
      .update({ student_group: newGroup })
      .eq("id", studentId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reassign student",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Student Reassigned",
      description: `Student moved to ${getGroupLabel(newGroup)}`,
    });

    // Refresh the students list
    queryClient.invalidateQueries({ queryKey: ["students", maktab, filterGroup] });

    // Move to next student or summary
    if (currentStudentIndex < students.length - 1) {
      setCurrentStudentIndex(currentStudentIndex);
    } else {
      setCurrentScreen("summary");
    }
  };

  const handleUpdateStudentName = async (studentId: string, newName: string) => {
    const { error } = await supabase
      .from("students")
      .update({ name: newName })
      .eq("id", studentId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update student name",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Name Updated",
      description: `Student name changed to ${newName}`,
    });

    queryClient.invalidateQueries({ queryKey: ["students", maktab, filterGroup] });
  };

  // Convert Student to StudentProgress for the dialog - must be before early returns
  const studentProgressData: StudentProgress | null = progressStudent ? {
    id: progressStudent.id,
    name: progressStudent.name,
    student_group: progressStudent.student_group || null,
    gender: (progressStudent.gender as "boys" | "girls") || maktab!,
    qaidah_level: progressStudent.qaidah_level ?? null,
    duas_status: progressStudent.duas_status ?? null,
    quran_juz: progressStudent.quran_juz ?? null,
    quran_completed: progressStudent.quran_completed ?? false,
    tajweed_level: progressStudent.tajweed_level ?? null,
    tajweed_completed: progressStudent.tajweed_completed ?? false,
    hifz_sabak: progressStudent.hifz_sabak ?? null,
    hifz_s_para: progressStudent.hifz_s_para ?? null,
    hifz_daur: progressStudent.hifz_daur ?? null,
    hifz_graduated: progressStudent.hifz_graduated ?? false,
    juz_amma_surah: (progressStudent as any).juz_amma_surah ?? null,
    juz_amma_completed: (progressStudent as any).juz_amma_completed ?? false,
  } : null;

  if ((isLoading && currentScreen !== "teacher") || checkingAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (currentScreen === "teacher") {
    return <TeacherSelect maktab={maktab} onSelectTeacher={handleTeacherSelect} />;
  }


  if (currentScreen === "attendance" && students[currentStudentIndex]) {
    return (
      <>
        <GhostModeBanner />
        <AttendanceCard
          key={`${students[currentStudentIndex].id}-${showProgressDialog}`}
          student={students[currentStudentIndex]}
          currentIndex={currentStudentIndex}
          totalStudents={students.length}
          onMarkAttendance={handleMarkAttendance}
          onCancel={handleCancelAttendance}
          onGoBack={handleGoBack}
          onRemoveStudent={handleRemoveStudent}
          onReassignStudent={handleReassignStudent}
          onUpdateStudentName={handleUpdateStudentName}
          maktab={maktab}
          currentGroup={filterGroup}
          availableGroups={getGroupCodesForMaktab(maktab)}
        />
        <ProgressPromptDialog
          open={showProgressDialog}
          onOpenChange={setShowProgressDialog}
          student={studentProgressData}
          isFirstPrompt={isFirstProgressPrompt}
          onSubmitGroupA={handleProgressSubmitGroupA}
          onSubmitGroupB={handleProgressSubmitGroupB}
          onSubmitGroupC={handleProgressSubmitGroupC}
          onGraduateAtoB={handleGraduateAtoB}
          onGraduateBtoC={handleGraduateBtoC}
          onSkip={handleProgressSkip}
          onSkipClassToday={handleSkipClassToday}
          isSubmitting={isUpdating || isGraduating}
        />
      </>
    );
  }

  if (currentScreen === "summary") {
    return (
      <>
        <GhostModeBanner />
        <AttendanceSummary
          teacher={selectedTeacher}
          date={sessionDate}
          records={attendanceRecords}
          onToggleStatus={handleToggleStatus}
          onComplete={handleCompleteAttendance}
          isSubmitting={isSubmitting}
        />
      </>
    );
  }

  if (currentScreen === "success") {
    const presentCount = attendanceRecords.filter((r) => r.status === "attended").length;
    const absentCount = attendanceRecords.filter((r) => r.status === "skipped").length;
    
    // Calculate non-Hifz counts for gold day calculation
    const nonHifzStudentIds = new Set(students.filter(s => s.student_group !== 'C').map(s => s.id));
    const nonHifzRecords = attendanceRecords.filter(r => nonHifzStudentIds.has(r.studentId));
    const nonHifzPresentCount = nonHifzRecords.filter((r) => r.status === "attended").length;
    const nonHifzAbsentCount = nonHifzRecords.filter((r) => r.status === "skipped").length;
    
    // Get unique groups from logged students
    const groupsLogged = [...new Set(students.map(s => s.student_group).filter(Boolean))] as string[];

    return (
      <>
        <GhostModeBanner />
        <SuccessScreen
          presentCount={presentCount}
          absentCount={absentCount}
          nonHifzPresentCount={nonHifzPresentCount}
          nonHifzAbsentCount={nonHifzAbsentCount}
          onStartNew={handleStartNewSession}
          maktab={maktab}
          groupsLogged={groupsLogged}
        />
      </>
    );
  }

  return null;
};

export default MaktabAttendance;
