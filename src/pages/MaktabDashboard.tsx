import { useState, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { MaktabNav } from "@/components/MaktabNav";
import AttendanceFilters, { TimePeriod } from "@/components/AttendanceFilters";
import AttendanceTable from "@/components/AttendanceTable";
import { useStudents } from "@/hooks/useStudents";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { subDays, format } from "date-fns";
import logo from "@/assets/masjid-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateCSVReport, downloadCSV } from "@/lib/csvExport";
import { paths } from "@/lib/portalPaths";


const MaktabDashboard = () => {
  const navigate = useNavigate();
  const { maktab } = useParams<{ maktab: "boys" | "girls" }>();
  
  const [period, setPeriod] = useState<TimePeriod>("30");
  const [teacher, setTeacher] = useState("all");
  const [studentId, setStudentId] = useState("all");
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const isValidMaktab = maktab === "boys" || maktab === "girls";
  
  const { students, isLoading: studentsLoading } = useStudents(isValidMaktab, maktab);
  const { toast } = useToast();

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

  useEffect(() => {
    if (isValidMaktab) {
      checkAccess();
    }
  }, [maktab, isValidMaktab]);

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate(paths.auth());
      return;
    }

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

    if (hasTeacherRole && !hasAdminRole) {
      if (!profile?.maktab) {
        toast({
          title: "Access Denied",
          description: "No maktab assigned to your account",
          variant: "destructive",
        });
        navigate(paths.home());
        return;
      }
      
      if (profile.maktab !== maktab) {
        toast({
          title: "Access Denied",
          description: `You can only access ${profile.maktab} maktab`,
          variant: "destructive",
        });
        navigate(paths.maktabDashboard(profile.maktab));
        return;
      }
    }

    setCheckingAccess(false);
  };


  const getDateRange = () => {
    if (period === "all") {
      return { startDate: undefined, endDate: undefined };
    }

    const days = parseInt(period);
    const endDate = format(new Date(), "yyyy-MM-dd");
    const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRange();

  const filters = {
    startDate,
    endDate,
    teacher: teacher !== "all" ? teacher : undefined,
    studentId: studentId !== "all" ? studentId : undefined,
    maktab,
  };

  const { data: records = [], isLoading } = useAttendanceHistory(filters);

  const handleReset = () => {
    setPeriod("30");
    setTeacher("all");
    setStudentId("all");
  };

  const handleDownloadCSV = () => {
    try {
      const csvContent = generateCSVReport(records, filters, students);
      const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
      const filename = `${maktab}_attendance_report_${timestamp}.csv`;
      
      downloadCSV(csvContent, filename);
      
      toast({
        title: "Download Complete",
        description: `Report saved as ${filename}`,
      });
    } catch (error) {
      console.error("Failed to generate CSV:", error);
      toast({
        title: "Download Failed",
        description: "Failed to generate CSV report. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!isValidMaktab) {
    return <Navigate to={paths.home()} replace />;
  }

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 safe-top safe-bottom">
      <div className="space-y-6">
        <div className="space-y-4">
          <MaktabNav maktab={maktab!} isAdmin={isAdmin} currentPage="history" />
          <div className="flex items-center gap-4">
            <img src={logo} alt="Masjid Logo" className="w-20 h-20" />
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                {maktab === "boys" ? "Boys" : "Girls"} History
              </h1>
              <p className="text-muted-foreground text-lg mt-2">
                View and filter records
              </p>
            </div>
          </div>
        </div>

        <AttendanceFilters
          period={period}
          teacher={teacher}
          studentId={studentId}
          students={students}
          onPeriodChange={setPeriod}
          onTeacherChange={setTeacher}
          onStudentChange={setStudentId}
          onReset={handleReset}
          onDownloadCSV={handleDownloadCSV}
        />

        <AttendanceTable records={records} isLoading={isLoading || studentsLoading} maktab={maktab} students={students} />
      </div>
    </div>
  );
};

export default MaktabDashboard;
