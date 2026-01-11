import { useState, useEffect } from "react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { Check, X, Clock, ChevronDown, ChevronUp, Users, Palmtree, Thermometer, StickyNote, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherAttendanceRecord, TeacherAttendanceStatus } from "@/hooks/useTeacherAttendanceRecord";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface TeacherAttendanceRecorderProps {
  maktab: "boys" | "girls";
  currentUserId: string;
  currentUserName: string;
}

interface Teacher {
  id: string;
  full_name: string;
}

type AbsenceType = "leave" | "sickness" | "other";

const ABSENCE_TYPE_CONFIG: Record<AbsenceType, { label: string; icon: React.ReactNode; color: string }> = {
  leave: { label: "Leave", icon: <Palmtree className="h-4 w-4" />, color: "text-orange-500" },
  sickness: { label: "Sickness", icon: <Thermometer className="h-4 w-4" />, color: "text-red-500" },
  other: { label: "Other", icon: <StickyNote className="h-4 w-4" />, color: "text-yellow-500" },
};

export const TeacherAttendanceRecorder = ({
  maktab,
  currentUserId,
  currentUserName,
}: TeacherAttendanceRecorderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  
  // Absence dialog state
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [absenceType, setAbsenceType] = useState<AbsenceType>("leave");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [absenceNote, setAbsenceNote] = useState("");
  const [showNoteError, setShowNoteError] = useState(false);
  const [savingAbsence, setSavingAbsence] = useState(false);
  
  const {
    records,
    isLoading,
    refetch,
    upsertAttendance,
    markAllTeachers,
    getTeacherStatus,
    isUpdating,
  } = useTeacherAttendanceRecord(maktab);

  useEffect(() => {
    const loadTeachers = async () => {
      setLoadingTeachers(true);
      try {
        // Get all teachers for this maktab (users with teacher role and matching maktab)
        // We'll filter out head teachers client-side (more robust with older rows)
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, full_name, is_head_teacher")
          .eq("maktab", maktab)
          .order("full_name");

        if (error) throw error;

        // Filter to only include users with teacher role (and exclude admins/head-teachers)
        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["teacher", "admin"]);

        if (rolesError) throw rolesError;

        const teacherIds = new Set((roles || []).filter((r) => r.role === "teacher").map((r) => r.user_id));
        const adminIds = new Set((roles || []).filter((r) => r.role === "admin").map((r) => r.user_id));

        const teacherProfiles = (profiles || []).filter(
          (p) => teacherIds.has(p.id) && !adminIds.has(p.id) && p.full_name && p.is_head_teacher !== true
        );

        setTeachers(teacherProfiles as Teacher[]);
      } catch (error) {
        console.error("Error loading teachers:", error);
      } finally {
        setLoadingTeachers(false);
      }
    };

    loadTeachers();
  }, [maktab]);

  const handleStatusChange = (teacher: Teacher, status: TeacherAttendanceStatus) => {
    const currentRecord = getTeacherStatus(teacher.full_name);
    
    // If clicking the same status, unselect (delete the record)
    if (currentRecord?.status === status) {
      // Delete the attendance record to unselect
      supabase
        .from("teacher_attendance")
        .delete()
        .eq("teacher_name", teacher.full_name)
        .eq("maktab", maktab)
        .eq("date", format(new Date(), "yyyy-MM-dd"))
        .then(() => refetch());
      return;
    }
    
    if (status === "leave") {
      // Open dialog for leave with date range and type selection
      setSelectedTeacher(teacher);
      setAbsenceType("leave");
      setStartDate(new Date());
      setEndDate(undefined);
      setAbsenceNote("");
      setShowNoteError(false);
      setAbsenceDialogOpen(true);
    } else {
      // Direct update for present or absent
      upsertAttendance({
        teacherName: teacher.full_name,
        status,
        markedBy: currentUserId,
        markedByName: currentUserName,
      });
    }
  };

  const handleSaveAbsence = async () => {
    if (!selectedTeacher) return;
    
    // Require a note when type is "other"
    if (absenceType === "other" && !absenceNote.trim()) {
      setShowNoteError(true);
      toast({ title: "Please add a note for 'Other' type", variant: "destructive" });
      return;
    }
    
    setSavingAbsence(true);
    try {
      const end = endDate || startDate;
      const datesToMark = eachDayOfInterval({ start: startDate, end });
      
      // Create records for each day in the range
      const records = datesToMark.map((date) => ({
        teacher_name: selectedTeacher.full_name,
        maktab,
        date: format(date, "yyyy-MM-dd"),
        status: "absent" as const,
        marked_by: currentUserId,
        marked_by_name: currentUserName,
        auto_marked: false,
      }));

      const { error } = await supabase
        .from("teacher_attendance")
        .upsert(records, {
          onConflict: "teacher_name,maktab,date",
        });

      if (error) throw error;

      // Also add notes to teacher_attendance_notes for tracking the reason
      const noteContent = absenceType === "other" ? absenceNote.trim() : ABSENCE_TYPE_CONFIG[absenceType].label;
      const notes = datesToMark.map((date) => ({
        teacher_name: selectedTeacher.full_name,
        maktab,
        date: format(date, "yyyy-MM-dd"),
        note: noteContent,
        note_type: absenceType,
      }));

      await supabase
        .from("teacher_attendance_notes")
        .upsert(notes, {
          onConflict: "teacher_name,maktab,date",
          ignoreDuplicates: false,
        });

      toast({
        title: "Absence recorded",
        description: `${selectedTeacher.full_name} marked as ${ABSENCE_TYPE_CONFIG[absenceType].label.toLowerCase()} for ${datesToMark.length} day${datesToMark.length > 1 ? 's' : ''}`,
      });

      setAbsenceDialogOpen(false);
      
      // Refresh the records
      refetch();
    } catch (error) {
      console.error("Error saving absence:", error);
      toast({
        title: "Error",
        description: "Failed to save absence record",
        variant: "destructive",
      });
    } finally {
      setSavingAbsence(false);
    }
  };

  const handleMarkAllPresent = () => {
    const teacherNames = teachers.map((t) => t.full_name);
    markAllTeachers({
      teachers: teacherNames,
      status: "present",
      markedBy: currentUserId,
      markedByName: currentUserName,
    });
  };

  const getStatusButton = (
    teacher: Teacher,
    status: TeacherAttendanceStatus,
    icon: React.ReactNode,
    label: string,
    activeClass: string
  ) => {
    const record = getTeacherStatus(teacher.full_name);
    const isActive = record?.status === status;

    return (
      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        onClick={() => handleStatusChange(teacher, status)}
        disabled={isUpdating}
        className={cn(
          "h-8 px-2 text-xs",
          isActive && activeClass
        )}
      >
        {icon}
        <span className="ml-1 hidden sm:inline">{label}</span>
      </Button>
    );
  };

  const markedCount = records.length;
  const presentCount = records.filter((r) => r.status === "present").length;

  return (
    <>
      <Card className="mb-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">
                    Teacher Attendance - {format(new Date(), "EEE, d MMM")}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {markedCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {presentCount}/{teachers.length} present
                    </Badge>
                  )}
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0">
              {loadingTeachers || isLoading ? (
                <div className="py-4 text-center text-muted-foreground">
                  Loading teachers...
                </div>
              ) : teachers.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground">
                  No teachers found for {maktab} maktab
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {teachers.map((teacher) => {
                      const record = getTeacherStatus(teacher.full_name);
                      return (
                        <div
                          key={teacher.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {teacher.full_name}
                            </span>
                            {record?.auto_marked && (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                Auto ✓
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {getStatusButton(
                              teacher,
                              "present",
                              <Check className="h-3 w-3" />,
                              "Present",
                              "bg-green-600 hover:bg-green-700"
                            )}
                            {getStatusButton(
                              teacher,
                              "absent",
                              <X className="h-3 w-3" />,
                              "Absent",
                              "bg-red-600 hover:bg-red-700"
                            )}
                            {getStatusButton(
                              teacher,
                              "leave",
                              <Clock className="h-3 w-3" />,
                              "Leave",
                              "bg-amber-600 hover:bg-amber-700"
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMarkAllPresent}
                      disabled={isUpdating}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Mark All Present
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Absence Dialog */}
      <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add note for {selectedTeacher?.full_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : "dd/mm/yyyy"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) => date < startDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={absenceType} onValueChange={(v) => setAbsenceType(v as AbsenceType)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <span className={ABSENCE_TYPE_CONFIG[absenceType].color}>
                        {ABSENCE_TYPE_CONFIG[absenceType].icon}
                      </span>
                      {ABSENCE_TYPE_CONFIG[absenceType].label}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  {(Object.keys(ABSENCE_TYPE_CONFIG) as AbsenceType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <span className={ABSENCE_TYPE_CONFIG[type].color}>
                          {ABSENCE_TYPE_CONFIG[type].icon}
                        </span>
                        {ABSENCE_TYPE_CONFIG[type].label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note Input - Required for "Other" type */}
            {absenceType === "other" && (
              <div className="space-y-2">
                <Label>Note <span className="text-destructive">*</span></Label>
                <Textarea
                  value={absenceNote}
                  onChange={(e) => {
                    setAbsenceNote(e.target.value);
                    if (e.target.value.trim()) setShowNoteError(false);
                  }}
                  placeholder="Please describe the reason..."
                  className={`min-h-[80px] ${showNoteError && !absenceNote.trim() ? "border-destructive" : ""}`}
                />
                {showNoteError && !absenceNote.trim() && (
                  <p className="text-xs text-destructive">A note is required when selecting "Other"</p>
                )}
              </div>
            )}

            {/* Save Button */}
            <Button 
              onClick={handleSaveAbsence} 
              className="w-full"
              disabled={savingAbsence}
            >
              {savingAbsence ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
