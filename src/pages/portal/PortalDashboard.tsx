import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { portalSupabase as supabase } from "@/integrations/supabase/portalClient";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLinkedStudents, useParentProfile, useMultiStudentAttendance } from "@/hooks/useParentData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, TrendingUp, User, BookOpen, CheckCircle, Star } from "lucide-react";
import { subDays } from "date-fns";
import { AttendanceChart } from "@/components/portal/AttendanceChart";
import { parseDuasStatus, getMaxLevel } from "@/lib/duasProgress";
import { getGroupShortLabel } from "@/lib/groups";
import { getJuzAmmaProgressPercent, getSurahLabel, isOnJuzAmmaTrack, JUZ_AMMA_SURAHS, TOTAL_JUZ_AMMA_SURAHS } from "@/lib/juzAmma";
import { AnnouncementBanner } from "@/components/portal/AnnouncementBanner";
import { ActionItemsBanner } from "@/components/portal/ActionItemsBanner";
import { useParentGhostMode } from "@/contexts/ParentGhostModeContext";

// Constants for progress calculations
const QAIDAH_MAX_LEVEL = 13;
const QURAN_MAX_JUZ = 30;
const TAJWEED_MAX_LEVEL = 12;

interface StudentWithProgress {
  id: string;
  name: string;
  student_code: string | null;
  student_group: string | null;
  maktab: string;
  status: string;
  qaidah_level: number | null;
  duas_status: string | null;
  quran_juz: number | null;
  quran_completed: boolean | null;
  tajweed_level: number | null;
  tajweed_completed: boolean | null;
  hifz_sabak: number | null;
  hifz_s_para: number | null;
  hifz_daur: number | null;
  hifz_graduated: boolean | null;
  juz_amma_surah: number | null;
  juz_amma_completed: boolean | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  student_id: string;
  teacher_name: string;
}

export default function PortalDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { isGhostMode } = useParentGhostMode();
  
  const { data: profile, isLoading: profileLoading } = useParentProfile();
  const { data: students, isLoading: studentsLoading } = useLinkedStudents();
  
  // Get all student IDs for multi-student attendance
  const studentIds = useMemo(() => students?.map(s => s.id) || [], [students]);
  const { data: attendance } = useMultiStudentAttendance(studentIds);

  useEffect(() => {
    // Skip auth check in ghost mode - admin is already authenticated
    if (isGhostMode) {
      setIsAuthenticated(true);
      return;
    }
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/portal/auth", { replace: true });
      } else {
        setIsAuthenticated(true);
        // Log dashboard view (only once per session)
        const sessionKey = `dashboard_view_logged_${session.user.id}`;
        if (!sessionStorage.getItem(sessionKey)) {
          logDashboardView(session.user.id, session.user.email || "");
          sessionStorage.setItem(sessionKey, "true");
        }
      }
    });
  }, [navigate, isGhostMode]);

  // Log dashboard view activity
  const logDashboardView = async (userId: string, email: string) => {
    try {
      // Get the maktabs of linked students
      const { data: links } = await supabase
        .from("parent_student_links")
        .select("student_id, students(maktab)")
        .eq("parent_id", userId)
        .not("verified_at", "is", null);
      
      const maktabs = [...new Set(links?.map((l: any) => l.students?.maktab).filter(Boolean))];
      
      await supabase
        .from("parent_activity_logs")
        .insert({
          parent_id: userId,
          parent_email: email.toLowerCase(),
          activity_type: "dashboard_view",
          maktab: maktabs.length === 1 ? maktabs[0] : maktabs.length > 1 ? "both" : null,
        });
    } catch (error) {
      console.error("Error logging dashboard view:", error);
    }
  };

  // Calculate attendance stats per student
  const getStudentAttendanceStats = (studentId: string) => {
    const last30Days = subDays(new Date(), 30);
    const studentAttendance = attendance?.filter(
      (a) => a.student_id === studentId && new Date(a.date) >= last30Days
    ) || [];
    const presentCount = studentAttendance.filter(
      (a) => a.status === "present" || a.status === "attended"
    ).length;
    const absentCount = studentAttendance.filter(
      (a) => a.status === "absent" || a.status === "skipped"
    ).length;
    const rate = studentAttendance.length > 0
      ? Math.round((presentCount / studentAttendance.length) * 100)
      : 0;
    const isPerfect = studentAttendance.length > 0 && absentCount === 0;
    return { rate, total: studentAttendance.length, present: presentCount, isPerfect };
  };

  // Get attendance records for a specific student
  const getStudentAttendance = (studentId: string): AttendanceRecord[] => {
    return attendance?.filter((a) => a.student_id === studentId) || [];
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isLoading = profileLoading || studentsLoading;

  // Render progress bars based on student group
  const renderStudentProgress = (student: StudentWithProgress) => {
    const group = student.student_group;
    
    if (!group) {
      return <p className="text-xs text-muted-foreground">No group assigned</p>;
    }

    if (group === "A") {
      const qaidahLevel = student.qaidah_level || 0;
      const qaidahProgress = Math.round((qaidahLevel / QAIDAH_MAX_LEVEL) * 100);
      const duasParsed = parseDuasStatus(student.duas_status);
      const duasMaxLevel = getMaxLevel(duasParsed.book);
      const duasProgress = duasParsed.completed 
        ? 100 
        : duasParsed.level && duasMaxLevel 
          ? Math.round((duasParsed.level / duasMaxLevel) * 100) 
          : 0;

      return (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-foreground">Qaidah</span>
              <div className="flex items-center gap-2">
                <span className="text-primary font-bold">{qaidahProgress}%</span>
                <span className="text-muted-foreground">({qaidahLevel}/{QAIDAH_MAX_LEVEL})</span>
              </div>
            </div>
            <Progress value={qaidahProgress} className="h-3 bg-muted/50" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-foreground">Duas</span>
              <div className="flex items-center gap-2">
                {duasParsed.completed ? (
                  <span className="flex items-center gap-1 text-success font-bold">
                    <CheckCircle className="h-4 w-4" /> 100%
                  </span>
                ) : (
                  <>
                    <span className="text-primary font-bold">{duasProgress}%</span>
                    <span className="text-muted-foreground">
                      {duasParsed.book ? `(${duasParsed.book} - ${duasParsed.level || 0}/${duasMaxLevel})` : "(Not started)"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <Progress value={duasProgress} className="h-3 bg-muted/50" />
          </div>
        </div>
      );
    }

    if (group === "B") {
      const quranJuz = student.quran_juz || 0;
      const quranCompleted = student.quran_completed || false;
      const quranProgress = quranCompleted ? 100 : Math.round((quranJuz / QURAN_MAX_JUZ) * 100);
      const tajweedLevel = student.tajweed_level || 0;
      const tajweedCompleted = student.tajweed_completed || false;
      const tajweedProgress = tajweedCompleted ? 100 : Math.round((tajweedLevel / TAJWEED_MAX_LEVEL) * 100);

      return (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-foreground">Quran</span>
              <div className="flex items-center gap-2">
                {quranCompleted ? (
                  <span className="flex items-center gap-1 text-success font-bold">
                    <CheckCircle className="h-4 w-4" /> 100%
                  </span>
                ) : (
                  <>
                    <span className="text-primary font-bold">{quranProgress}%</span>
                    <span className="text-muted-foreground">(Juz {quranJuz}/{QURAN_MAX_JUZ})</span>
                  </>
                )}
              </div>
            </div>
            <Progress value={quranProgress} className="h-3 bg-muted/50" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-foreground">Tajweed</span>
              <div className="flex items-center gap-2">
                {tajweedCompleted ? (
                  <span className="flex items-center gap-1 text-success font-bold">
                    <CheckCircle className="h-4 w-4" /> 100%
                  </span>
                ) : (
                  <>
                    <span className="text-primary font-bold">{tajweedProgress}%</span>
                    <span className="text-muted-foreground">(Level {tajweedLevel}/{TAJWEED_MAX_LEVEL})</span>
                  </>
                )}
              </div>
            </div>
            <Progress value={tajweedProgress} className="h-3 bg-muted/50" />
          </div>
        </div>
      );
    }

    if (group === "C") {
      const hifzSabak = student.hifz_sabak || 0;
      const hifzProgress = Math.round((hifzSabak / 30) * 100);
      const hifzGraduated = student.hifz_graduated || false;

      const juzAmmaSurah = student.juz_amma_surah;
      const juzAmmaCompleted = student.juz_amma_completed || false;
      const onJuzAmmaTrack =
        isOnJuzAmmaTrack(student) ||
        (student.student_group === "C" && !!juzAmmaSurah && !juzAmmaCompleted && !student.hifz_sabak);

      const juzAmmaProgress = getJuzAmmaProgressPercent(juzAmmaSurah, juzAmmaCompleted);
      const currentSurahLabel = juzAmmaSurah ? getSurahLabel(juzAmmaSurah) : "Not Started";
      const completedCount = juzAmmaSurah ? JUZ_AMMA_SURAHS.findIndex((s) => s.number === juzAmmaSurah) : 0;

      return (
        <div className="space-y-4">
          {hifzGraduated ? (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" />
              <span className="font-bold text-base">Hafiz Complete! 100%</span>
            </div>
          ) : onJuzAmmaTrack ? (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-foreground">Juzʾ ʿAmma</span>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold">{juzAmmaProgress}%</span>
                  <span className="text-muted-foreground">({completedCount}/{TOTAL_JUZ_AMMA_SURAHS})</span>
                </div>
              </div>
              <Progress value={juzAmmaProgress} className="h-3 bg-muted/50" />
              <p className="mt-2 text-xs text-muted-foreground">Current: {currentSurahLabel}</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-foreground">Hifz (Sabak)</span>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold">{hifzProgress}%</span>
                  <span className="text-muted-foreground">(Juz {hifzSabak}/30)</span>
                </div>
              </div>
              <Progress value={hifzProgress} className="h-3 bg-muted/50" />
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <PortalLayout title="Dashboard">
      <div className="space-y-6">
        {/* Announcement Banner */}
        <AnnouncementBanner />

        {/* Action Items Banner */}
        <ActionItemsBanner />
        
        {/* Welcome Message */}
        <div>
          {profileLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <h2 className="text-2xl font-bold text-foreground">
              Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
            </h2>
          )}
          <p className="text-muted-foreground mt-1">
            Here's an overview of your children's progress.
          </p>
        </div>

        {/* Students List with Progress and Individual Charts */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : students && students.length > 0 ? (
            students.map((student) => {
              const attendanceStats = getStudentAttendanceStats(student.id);
              const studentAttendance = getStudentAttendance(student.id);
              
                const isLowAttendance = attendanceStats.rate < 40 && attendanceStats.total > 0;
                
                return (
                <Card key={student.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{student.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          {student.student_group && (
                            <Badge variant="secondary" className="text-xs">
                              {getGroupShortLabel(student.student_group)}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs capitalize">
                            {student.maktab}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {/* Attendance Banner - Below student name */}
                  <div className={`flex items-center justify-center gap-3 py-3 px-4 mx-4 mb-3 rounded-lg ${
                    attendanceStats.isPerfect && attendanceStats.total > 0 
                      ? 'bg-gradient-to-r from-yellow-500/20 via-yellow-400/10 to-yellow-500/20' 
                      : isLowAttendance
                        ? 'bg-red-500/10'
                        : 'bg-primary/10'
                  }`}>
                    {attendanceStats.isPerfect && attendanceStats.total > 0 && (
                      <Star className="h-8 w-8 text-yellow-500 fill-yellow-500 animate-pulse" />
                    )}
                    <span className={`text-4xl font-bold ${isLowAttendance ? 'text-red-600' : 'text-primary'}`}>
                      {attendanceStats.rate}%
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({attendanceStats.present}/{attendanceStats.total} days)
                    </span>
                    {attendanceStats.isPerfect && attendanceStats.total > 0 && (
                      <span className="text-sm font-medium text-yellow-600">Perfect!</span>
                    )}
                  </div>
                  <CardContent className="pt-0 space-y-4">
                    {/* Progress Bars */}
                    <div>
                      {renderStudentProgress(student as StudentWithProgress)}
                    </div>
                    
                    {/* Individual Attendance Chart */}
                    <div className="pt-2">
                      <AttendanceChart 
                        attendance={studentAttendance} 
                        isLoading={!attendance} 
                      />
                    </div>
                    
                    {/* Quick Links */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                      <div 
                        className="flex items-center justify-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground py-2 rounded-md hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/portal/attendance?student=${student.id}`)}
                      >
                        <Calendar className="h-4 w-4" />
                        <span>Attendance</span>
                      </div>
                      <div 
                        className="flex items-center justify-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground py-2 rounded-md hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/portal/progress?student=${student.id}`)}
                      >
                        <TrendingUp className="h-4 w-4" />
                        <span>Progress</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No students linked</h3>
                <p className="text-sm text-muted-foreground">
                  Contact the school to link your children to your account.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}