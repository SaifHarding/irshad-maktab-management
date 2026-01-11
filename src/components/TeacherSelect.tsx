import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, ChevronDown, Settings2 } from "lucide-react";
import logo from "@/assets/masjid-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { getGroupLabel, getGroupCodesForMaktab, type GroupCode } from "@/lib/groups";
import { useGhostMode } from "@/contexts/GhostModeContext";
import GhostModeBanner from "@/components/GhostModeBanner";
import { MaktabNav } from "@/components/MaktabNav";
import { PendingRegistrationsBanner } from "@/components/admin/PendingRegistrationsBanner";
import { TeacherAttendanceRecorder } from "@/components/TeacherAttendanceRecorder";

interface TeacherSelectProps {
  maktab: "boys" | "girls";
  onSelectTeacher: (teacher: string, selectedGroups: GroupCode[]) => void;
}

const TeacherSelect = ({ maktab, onSelectTeacher }: TeacherSelectProps) => {
  const today = format(new Date(), "EEEE, MMMM d, yyyy");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHeadTeacher, setIsHeadTeacher] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [submittedTeachers, setSubmittedTeachers] = useState<Set<string>>(new Set());
  const [recordedGroups, setRecordedGroups] = useState<{ group: string; teacher: string }[]>([]);
  
  // Current user state
  const [realUserName, setRealUserName] = useState<string | null>(null);
  const [realUserId, setRealUserId] = useState<string | null>(null);
  const [assignedGroups, setAssignedGroups] = useState<GroupCode[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<GroupCode[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Banner visibility setting
  const [bannerEnabled, setBannerEnabled] = useState(false);
  
  // Ghost mode
  const { ghostUser, isGhostMode } = useGhostMode();
  
  // Use ghost user name if in ghost mode, otherwise use real user name
  const currentUserName = isGhostMode && ghostUser ? ghostUser.full_name : realUserName;

  useEffect(() => {
    loadCurrentUser();
    loadSubmittedTeachers();
    loadBannerSetting();
  }, [maktab]);

  const loadBannerSetting = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "teacher_attendance_banner")
      .single();
    
    if (data?.value && typeof data.value === "object") {
      const settings = data.value as { boys: boolean; girls: boolean };
      // Default to true for boys, false for girls if setting doesn't exist for that maktab
      setBannerEnabled(settings[maktab] ?? (maktab === "boys"));
    } else {
      // No setting exists yet - default boys to true, girls to false
      setBannerEnabled(maktab === "boys");
    }
  };

  const loadSubmittedTeachers = async () => {
    const dateStr = format(new Date(), "yyyy-MM-dd");
    
    // Get all attendance records for today with student info
    const { data: attendanceData } = await supabase
      .from("attendance_records")
      .select("teacher_name, student_id")
      .eq("date", dateStr)
      .eq("maktab", maktab);
    
    if (attendanceData && attendanceData.length > 0) {
      const uniqueTeachers = new Set(attendanceData.map(r => r.teacher_name));
      setSubmittedTeachers(uniqueTeachers);
      
      // Get student IDs that have attendance
      const studentIds = [...new Set(attendanceData.map(r => r.student_id))];
      
      // Fetch the groups for these students
      const { data: students } = await supabase
        .from("students")
        .select("id, student_group")
        .in("id", studentIds);
      
      if (students) {
        // Create a map of student_id to group
        const studentGroupMap = new Map(students.map(s => [s.id, s.student_group]));
        
        // Build group -> teacher mapping
        const groupTeacherMap = new Map<string, Set<string>>();
        
        attendanceData.forEach(record => {
          const group = studentGroupMap.get(record.student_id);
          if (group) {
            if (!groupTeacherMap.has(group)) {
              groupTeacherMap.set(group, new Set());
            }
            groupTeacherMap.get(group)!.add(record.teacher_name);
          }
        });
        
        // Convert to array format
        const recorded: { group: string; teacher: string }[] = [];
        groupTeacherMap.forEach((teachers, group) => {
          recorded.push({ group, teacher: [...teachers].join(", ") });
        });
        
        // Sort by group order
        recorded.sort((a, b) => {
          const order = getGroupCodesForMaktab(maktab);
          return order.indexOf(a.group) - order.indexOf(b.group);
        });
        
        setRecordedGroups(recorded);
      }
    } else {
      setSubmittedTeachers(new Set());
      setRecordedGroups([]);
    }
  };

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    
    setRealUserId(user.id);

    // Get user profile including head teacher status
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, is_head_teacher")
      .eq("id", user.id)
      .single();

    if (profile?.full_name) {
      setRealUserName(profile.full_name);
    }
    
    // Set head teacher status from profile
    setIsHeadTeacher(profile?.is_head_teacher || false);

    // Check admin status
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = roles?.map(r => r.role) || [];
    setIsAdmin(userRoles.includes("admin"));

    // Determine which name to use for fetching groups
    const nameToUse = isGhostMode && ghostUser ? ghostUser.full_name : profile?.full_name;
    
    // Get teacher's assigned groups for this maktab
    if (nameToUse) {
      const { data: teacherGroups } = await supabase
        .from("teacher_groups")
        .select("group_code")
        .eq("teacher_name", nameToUse)
        .eq("maktab", maktab);

      if (teacherGroups && teacherGroups.length > 0) {
        const groups = teacherGroups.map(tg => tg.group_code as GroupCode);
        setAssignedGroups(groups);
        setSelectedGroups(groups); // Pre-select assigned groups
      } else {
        // If no groups assigned, default to all groups for this maktab
        const maktabGroups = getGroupCodesForMaktab(maktab);
        setAssignedGroups([]);
        setSelectedGroups([...maktabGroups] as GroupCode[]);
      }
    }

    setLoading(false);
  };

  // Reload groups when ghost mode changes
  useEffect(() => {
    if (!loading) {
      const loadGhostUserGroups = async () => {
        const nameToUse = isGhostMode && ghostUser ? ghostUser.full_name : realUserName;
        if (nameToUse) {
          const { data: teacherGroups } = await supabase
            .from("teacher_groups")
            .select("group_code")
            .eq("teacher_name", nameToUse)
            .eq("maktab", maktab);

          if (teacherGroups && teacherGroups.length > 0) {
            const groups = teacherGroups.map(tg => tg.group_code as GroupCode);
            setAssignedGroups(groups);
            setSelectedGroups(groups);
          } else {
            const maktabGroups = getGroupCodesForMaktab(maktab);
            setAssignedGroups([]);
            setSelectedGroups([...maktabGroups] as GroupCode[]);
          }
        }
      };
      loadGhostUserGroups();
    }
  }, [isGhostMode, ghostUser, maktab, loading, realUserName]);

  const checkForExistingAttendance = async (teacher: string, groups: GroupCode[]) => {
    const dateStr = format(new Date(), "yyyy-MM-dd");
    
    // First get students in the selected groups
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id")
      .eq("maktab", maktab)
      .in("student_group", groups)
      .neq("status", "left");
    
    if (studentsError) {
      console.error("Error fetching students:", studentsError);
      return false;
    }
    
    if (!students || students.length === 0) return false;
    
    const studentIds = students.map(s => s.id);
    
    // Check if any attendance exists for these specific students
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id")
      .eq("date", dateStr)
      .eq("maktab", maktab)
      .eq("teacher_name", teacher)
      .in("student_id", studentIds)
      .limit(1);
    
    if (error) {
      console.error("Error checking duplicates:", error);
      return false;
    }
    
    return data && data.length > 0;
  };

  const handleStartRegister = async () => {
    if (!currentUserName || selectedGroups.length === 0) {
      toast({
        title: "Cannot Start",
        description: selectedGroups.length === 0 ? "Please select at least one group" : "User not found",
        variant: "destructive",
      });
      return;
    }

    setCheckingDuplicates(true);
    
    const hasDuplicates = await checkForExistingAttendance(currentUserName, selectedGroups);
    setCheckingDuplicates(false);
    
    if (hasDuplicates) {
      setShowDuplicateWarning(true);
    } else {
      onSelectTeacher(currentUserName, selectedGroups);
    }
  };

  const handleContinueAnyway = () => {
    setShowDuplicateWarning(false);
    if (currentUserName) {
      onSelectTeacher(currentUserName, selectedGroups);
    }
  };

  const handleGroupToggle = (group: GroupCode) => {
    setSelectedGroups(prev => {
      if (prev.includes(group)) {
        return prev.filter(g => g !== group);
      } else {
        return [...prev, group];
      }
    });
  };

  const getSelectedGroupsLabel = () => {
    const maktabGroups = getGroupCodesForMaktab(maktab);
    if (selectedGroups.length === 0) return "No groups selected";
    if (selectedGroups.length === maktabGroups.length) return "All groups";
    return selectedGroups.map(g => getGroupLabel(g).split(' ')[1]).join(", ");
  };

  if (loading) {
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
    <div className="min-h-screen bg-background flex flex-col px-3 py-4 sm:p-4 safe-top safe-bottom">
      <GhostModeBanner />
      <MaktabNav maktab={maktab} isAdmin={isAdmin} currentPage="attendance" />

      {(isHeadTeacher || isAdmin) && !isGhostMode && realUserName && (
        <PendingRegistrationsBanner userFullName={realUserName} maktab={maktab} />
      )}

      {(isHeadTeacher || isAdmin) && !isGhostMode && bannerEnabled && realUserId && (
        <TeacherAttendanceRecorder
          maktab={maktab}
          currentUserId={realUserId}
          currentUserName={realUserName ?? ""}
        />
      )}

      {recordedGroups.length > 0 && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="font-semibold text-green-800 dark:text-green-300">
              Today's attendance recorded
            </p>
          </div>
          <div className="space-y-1.5 ml-9">
            {recordedGroups.map(({ group, teacher }) => (
              <div key={group} className="flex items-center justify-between text-sm">
                <span className="text-green-700 dark:text-green-400 font-medium">
                  {getGroupLabel(group)}
                </span>
                <span className="text-green-600 dark:text-green-500">
                  {teacher}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center space-y-6 sm:space-y-8">
        <div className="text-center space-y-4 sm:space-y-6">
          <img src={logo} alt="Masjid Logo" className="w-32 h-32 sm:w-40 sm:h-40 mx-auto" />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">
            {maktab === "boys" ? "Boys" : "Girls"} Maktab
          </h1>
          <p className="text-muted-foreground text-lg sm:text-xl">{today}</p>
        </div>

        <div className="w-full space-y-4 sm:space-y-5">
          {currentUserName ? (
            <>
              <p className="text-center text-muted-foreground text-lg">
                Asalamulaikum, <span className="font-semibold text-foreground">{currentUserName}</span>
              </p>
              
              <Button
                onClick={handleStartRegister}
                size="lg"
                disabled={checkingDuplicates || selectedGroups.length === 0}
                className="w-full h-20 sm:h-28 text-2xl sm:text-3xl font-semibold touch-manipulation active:scale-95 transition-transform relative"
              >
                {checkingDuplicates ? "Checking..." : "Start Register"}
                {submittedTeachers.has(currentUserName) && (
                  <CheckCircle2 className="absolute top-3 right-3 w-7 h-7 text-green-500" />
                )}
              </Button>

              {/* Advanced group selection - collapsed by default */}
              <Collapsible open={showAdvancedOptions} onOpenChange={setShowAdvancedOptions}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                    <Settings2 className="w-4 h-4" />
                    <span>Change groups ({getSelectedGroupsLabel()})</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <p className="text-xs text-muted-foreground mb-3">
                      Select which groups to include in this session:
                    </p>
                    {getGroupCodesForMaktab(maktab).map((group) => {
                      const isAssigned = assignedGroups.includes(group as GroupCode);
                      return (
                        <label
                          key={group}
                          className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted transition-colors"
                        >
                          <Checkbox
                            checked={selectedGroups.includes(group as GroupCode)}
                            onCheckedChange={() => handleGroupToggle(group as GroupCode)}
                            className="h-5 w-5"
                          />
                          <span className="flex-1 text-sm">
                            {getGroupLabel(group)}
                          </span>
                          {isAssigned && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Your group
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Unable to load user profile.</p>
              <p className="text-sm text-muted-foreground mt-2">Please try logging out and back in.</p>
            </div>
          )}
        </div>

        <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Attendance Already Recorded
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                Attendance for today has already been recorded. Would you like to continue anyway?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleContinueAnyway}>
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default TeacherSelect;
