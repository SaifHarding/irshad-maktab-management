import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Home, Download, ChevronDown, ChevronRight, Calendar as CalendarIcon, Users, Settings, Star, MessageSquare, Trash2, ArrowLeft, CalendarOff, Plus, X, ToggleLeft, ToggleRight } from "lucide-react";
import { useTeacherAttendance, TeacherAttendanceData } from "@/hooks/useTeacherAttendance";
import { generateTeacherAttendanceCSV, downloadCSV } from "@/lib/csvExport";
import { format, subMonths, getDaysInMonth, getDay, isSameDay, parseISO, addDays, eachDayOfInterval } from "date-fns";
import { Thermometer, Palmtree, StickyNote } from "lucide-react";
import { paths } from "@/lib/portalPaths";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type NoteType = "leave" | "sickness" | "other";

type DayNote = {
  id: string;
  teacher_name: string;
  maktab: string;
  date: string;
  note: string;
  note_type: NoteType;
};

const NOTE_TYPE_CONFIG: Record<NoteType, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  leave: { label: "Leave", icon: <Palmtree className="h-3 w-3" />, color: "text-orange-600", bgColor: "bg-orange-100 border-orange-300 dark:bg-orange-900/30 dark:border-orange-700" },
  sickness: { label: "Sickness", icon: <Thermometer className="h-3 w-3" />, color: "text-red-600", bgColor: "bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700" },
  other: { label: "Other", icon: <StickyNote className="h-3 w-3" />, color: "text-yellow-600", bgColor: "bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700" },
};

// December 1st 2025 is disabled
const DISABLED_DATE = new Date(2025, 11, 1);

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_INDEX_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6
};

const DEFAULT_TARGET_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday"];

type SchoolHoliday = {
  date: string;
  reason: string;
};

const TeacherCard = ({
  teacher,
  isExpanded,
  onToggle,
  selectedMonth,
  targetDays,
  onEditTargetDays,
  notes,
  onDayClick,
  onDeletePeriod,
  holidays,
}: {
  teacher: TeacherAttendanceData;
  isExpanded: boolean;
  onToggle: () => void;
  selectedMonth: Date;
  targetDays: string[];
  onEditTargetDays: () => void;
  notes: DayNote[];
  onDayClick: (date: Date) => void;
  onDeletePeriod: (startDate: string, endDate: string, noteType: NoteType) => void;
  holidays: SchoolHoliday[];
}) => {
  const targetDayIndices = targetDays.map(d => DAY_INDEX_MAP[d]);
  
  // Calculate target days count for this month
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const daysInMonth = getDaysInMonth(selectedMonth);
  let targetDaysInMonth = 0;
  
  // Calculate target days count for this month (excluding holidays)
  const isHoliday = (date: Date) => holidays.some(h => isSameDay(parseISO(h.date), date));
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    // Skip Dec 1st 2025 and holidays
    if (isSameDay(date, DISABLED_DATE)) continue;
    if (isHoliday(date)) continue;
    if (targetDayIndices.includes(getDay(date)) && date <= new Date()) {
      targetDaysInMonth++;
    }
  }

  const allTargetsCompleted = targetDaysInMonth > 0 && teacher.daysCount >= targetDaysInMonth;

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <div>
                  <CardTitle className="text-base">{teacher.teacherName}</CardTitle>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {targetDays.length > 0 ? targetDays.join(", ") : "No target days set"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTargetDays();
                  }}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                {allTargetsCompleted && (
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                )}
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    {teacher.daysCount}
                    <span className="text-sm font-normal text-muted-foreground">/{targetDaysInMonth}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">days</div>
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                month={selectedMonth}
                onMonthChange={() => {}}
                onDayClick={(date) => {
                  // Don't allow click on Dec 1st 2025
                  if (isSameDay(date, DISABLED_DATE)) return;
                  onDayClick(date);
                }}
                disabled={(date) => isSameDay(date, DISABLED_DATE) || isHoliday(date)}
                modifiers={{
                  taught: teacher.dates,
                  absent: teacher.absentDates,
                  holiday: (date) => isHoliday(date),
                  weekend: (date) => {
                    const day = date.getDay();
                    return day === 0 || day === 5 || day === 6;
                  },
                  targetDay: (date) => {
                    // Don't highlight if all 4 weekdays are selected
                    if (targetDays.length === 4) return false;
                    const day = date.getDay();
                    return targetDayIndices.includes(day) && !teacher.dates.some(
                      d => d.toDateString() === date.toDateString()
                    ) && !teacher.absentDates.some(
                      d => d.toDateString() === date.toDateString()
                    );
                  },
                  hasNote: (date) => notes.some(n => n.note_type === "other" && isSameDay(new Date(n.date), date)),
                  hasLeave: (date) => notes.some(n => n.note_type === "leave" && isSameDay(new Date(n.date), date)),
                  hasSickness: (date) => notes.some(n => n.note_type === "sickness" && isSameDay(new Date(n.date), date)),
                }}
                modifiersStyles={{
                  taught: {
                    backgroundColor: teacher.maktab === "boys" ? "hsl(221, 83%, 53%)" : "hsl(330, 81%, 60%)",
                    color: "white",
                    fontWeight: "bold",
                  },
                  absent: {
                    backgroundColor: "hsl(0, 72%, 51%)",
                    color: "white",
                    fontWeight: "bold",
                  },
                  holiday: {
                    backgroundColor: "hsl(var(--muted))",
                    color: "hsl(var(--muted-foreground))",
                    opacity: 0.5,
                    textDecoration: "line-through",
                  },
                  weekend: {
                    color: "hsl(var(--muted-foreground))",
                    opacity: 0.3,
                  },
                  targetDay: {
                    border: "2px dashed hsl(var(--primary))",
                    borderRadius: "6px",
                  },
                  hasNote: {
                    backgroundColor: "hsl(25, 95%, 53%)",
                    color: "white",
                    fontWeight: "bold",
                    borderRadius: "6px",
                  },
                  hasLeave: {
                    backgroundColor: "hsl(25, 95%, 53%)",
                    color: "white",
                    fontWeight: "bold",
                    borderRadius: "6px",
                  },
                  hasSickness: {
                    backgroundColor: "hsl(25, 95%, 53%)",
                    color: "white",
                    fontWeight: "bold",
                    borderRadius: "6px",
                  },
                }}
                className="rounded-md border cursor-pointer"
                classNames={{
                  nav_button: "hidden",
                  caption: "flex justify-center pt-1 relative items-center text-sm font-medium",
                  day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors cursor-pointer",
                }}
              />
            </div>
            {notes.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Notes
                </div>
                {(() => {
                  // Group consecutive notes of the same type into ranges
                  const sortedNotes = [...notes].sort((a, b) => 
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                  );
                  
                  const groupedNotes: { startDate: string; endDate: string; type: NoteType; note: string }[] = [];
                  
                  sortedNotes.forEach((n) => {
                    const lastGroup = groupedNotes[groupedNotes.length - 1];
                    const noteDate = new Date(n.date);
                    
                    if (lastGroup && lastGroup.type === n.note_type) {
                      // Check if this date is consecutive (next day)
                      const lastEndDate = new Date(lastGroup.endDate);
                      const dayDiff = Math.round((noteDate.getTime() - lastEndDate.getTime()) / (1000 * 60 * 60 * 24));
                      
                      if (dayDiff === 1) {
                        // Extend the range
                        lastGroup.endDate = n.date;
                        return;
                      }
                    }
                    
                    // Start a new group
                    groupedNotes.push({
                      startDate: n.date,
                      endDate: n.date,
                      type: n.note_type as NoteType,
                      note: n.note,
                    });
                  });
                  
                  return groupedNotes.map((group, idx) => {
                    const config = NOTE_TYPE_CONFIG[group.type || "other"];
                    const isRange = group.startDate !== group.endDate;
                    const dateDisplay = isRange
                      ? `${format(new Date(group.startDate), "MMM d")} - ${format(new Date(group.endDate), "MMM d")}`
                      : format(new Date(group.startDate), "MMM d");
                    
                    return (
                      <div
                        key={`${group.startDate}-${group.type}-${idx}`}
                        className={`text-xs border rounded p-2 ${config.bgColor}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div 
                            className="flex items-center gap-1.5 flex-1 cursor-pointer hover:opacity-80"
                            onClick={() => onDayClick(new Date(group.startDate))}
                          >
                            <span className={config.color}>{config.icon}</span>
                            <span className="font-medium">{dateDisplay}:</span>
                            <span className="truncate">{group.note || config.label}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeletePeriod(group.startDate, group.endDate, group.type);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1">
              {teacher.dates
                .sort((a, b) => a.getTime() - b.getTime())
                .map((date) => {
                  const noteForDate = notes.find(n => isSameDay(new Date(n.date), date));
                  const noteConfig = noteForDate ? NOTE_TYPE_CONFIG[noteForDate.note_type || "other"] : null;
                  return (
                    <span
                      key={date.toISOString()}
                      className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                        teacher.maktab === "boys"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-pink-100 text-pink-700"
                      }`}
                    >
                      {noteConfig && <span className={noteConfig.color}>{noteConfig.icon}</span>}
                      {format(date, "MMM d")}
                    </span>
                  );
                })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

const TeacherAttendance = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [maktabFilter, setMaktabFilter] = useState<"all" | "boys" | "girls">("all");
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [teacherTargetDays, setTeacherTargetDays] = useState<Record<string, string[]>>({});
  const [tempTargetDays, setTempTargetDays] = useState<string[]>([]);
  const [editingTeacher, setEditingTeacher] = useState<string | null>(null);
  
  // Notes state
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedNoteTeacher, setSelectedNoteTeacher] = useState<{ name: string; maktab: string } | null>(null);
  const [selectedNoteDate, setSelectedNoteDate] = useState<Date | null>(null);
  const [selectedNoteEndDate, setSelectedNoteEndDate] = useState<Date | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("other");
  const [existingNoteId, setExistingNoteId] = useState<string | null>(null);
  
  // Holidays state
  const [holidays, setHolidays] = useState<SchoolHoliday[]>([]);
  const [holidaysDialogOpen, setHolidaysDialogOpen] = useState(false);
  const [newHolidayStartDate, setNewHolidayStartDate] = useState("");
  const [newHolidayEndDate, setNewHolidayEndDate] = useState("");
  const [newHolidayReason, setNewHolidayReason] = useState("");

  // Banner visibility state
  const [bannerSettings, setBannerSettings] = useState<{ boys: boolean; girls: boolean }>({ boys: true, girls: false });

  // Delete period confirmation state
  const [deletePeriodConfirm, setDeletePeriodConfirm] = useState<{
    teacherName: string;
    maktab: string;
    startDate: string;
    endDate: string;
    noteType: NoteType;
  } | null>(null);

  const { teachers, boysTeachers, girlsTeachers, totalDays, averageDays, isLoading } = useTeacherAttendance(
    selectedMonth,
    maktabFilter
  );

  useEffect(() => {
    checkAdminStatus();
    loadTeacherTargetDays();
    loadHolidays();
    loadBannerSettings();
  }, []);

  useEffect(() => {
    loadNotes();
  }, [selectedMonth]);

  const loadBannerSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "teacher_attendance_banner")
      .single();
    
    if (data?.value && typeof data.value === "object") {
      setBannerSettings(data.value as { boys: boolean; girls: boolean });
    }
  };

  const saveBannerSettings = async (maktab: "boys" | "girls", enabled: boolean) => {
    const newSettings = { ...bannerSettings, [maktab]: enabled };
    
    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "teacher_attendance_banner",
        value: newSettings,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

    if (error) {
      toast({ title: "Error saving settings", variant: "destructive" });
    } else {
      setBannerSettings(newSettings);
      toast({ title: `Banner ${enabled ? "enabled" : "disabled"} for ${maktab} maktab` });
    }
  };

  const loadHolidays = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "school_holidays")
      .single();
    
    if (data?.value && Array.isArray(data.value)) {
      setHolidays(data.value as SchoolHoliday[]);
    }
  };

  const saveHolidays = async (updatedHolidays: SchoolHoliday[]) => {
    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "school_holidays",
        value: updatedHolidays,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

    if (error) {
      toast({ title: "Error saving holidays", variant: "destructive" });
    } else {
      setHolidays(updatedHolidays);
      toast({ title: "Holidays updated" });
    }
  };

  const addHoliday = async () => {
    if (!newHolidayStartDate) return;
    
    const endDate = newHolidayEndDate || newHolidayStartDate;
    const reason = newHolidayReason || "School Closed";
    
    // Generate all dates in the range
    const start = parseISO(newHolidayStartDate);
    const end = parseISO(endDate);
    
    if (end < start) {
      toast({ title: "End date must be after start date", variant: "destructive" });
      return;
    }
    
    const datesToAdd = eachDayOfInterval({ start, end });
    const newHolidays: SchoolHoliday[] = [];
    
    for (const date of datesToAdd) {
      const dateStr = format(date, "yyyy-MM-dd");
      if (!holidays.some(h => h.date === dateStr)) {
        newHolidays.push({ date: dateStr, reason });
      }
    }
    
    if (newHolidays.length === 0) {
      toast({ title: "All dates in range already exist", variant: "destructive" });
      return;
    }
    
    const updatedHolidays = [...holidays, ...newHolidays]
      .sort((a, b) => a.date.localeCompare(b.date));
    await saveHolidays(updatedHolidays);
    setNewHolidayStartDate("");
    setNewHolidayEndDate("");
    setNewHolidayReason("");
    
    toast({ title: `Added ${newHolidays.length} holiday${newHolidays.length > 1 ? 's' : ''}` });
  };

  const removeHoliday = async (dateToRemove: string) => {
    const updatedHolidays = holidays.filter(h => h.date !== dateToRemove);
    await saveHolidays(updatedHolidays);
  };

  const loadNotes = async () => {
    const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    
    const { data } = await supabase
      .from("teacher_attendance_notes")
      .select("*")
      .gte("date", format(startOfMonth, "yyyy-MM-dd"))
      .lte("date", format(endOfMonth, "yyyy-MM-dd"));
    
    if (data) {
      setNotes(data as DayNote[]);
    }
  };

  const getNotesForTeacher = (teacherName: string, maktab: string) => {
    return notes.filter(n => n.teacher_name === teacherName && n.maktab === maktab);
  };

  const handleDayClick = (teacherName: string, maktab: string, date: Date) => {
    const existingNote = notes.find(
      n => n.teacher_name === teacherName && n.maktab === maktab && n.date === format(date, "yyyy-MM-dd")
    );
    
    setSelectedNoteTeacher({ name: teacherName, maktab });
    setSelectedNoteDate(date);
    setSelectedNoteEndDate(null); // Reset end date
    setNoteText(existingNote?.note || "");
    setNoteType((existingNote?.note_type as NoteType) || "other");
    setExistingNoteId(existingNote?.id || null);
    setNoteDialogOpen(true);
  };

  const saveNote = async () => {
    if (!selectedNoteTeacher || !selectedNoteDate) return;
    
    // Require a note when type is "other"
    if (noteType === "other" && !noteText.trim()) {
      toast({ title: "Please add a note for 'Other' type", variant: "destructive" });
      return;
    }
    
    const hasContent = noteText.trim() !== "" || noteType !== "other";
    
    if (!hasContent) {
      // Delete note if no type selected and no text
      if (existingNoteId) {
        await supabase.from("teacher_attendance_notes").delete().eq("id", existingNoteId);
        toast({ title: "Note deleted" });
      }
    } else if (existingNoteId) {
      // Update existing single note
      await supabase
        .from("teacher_attendance_notes")
        .update({ note: noteText || "", note_type: noteType, updated_at: new Date().toISOString() })
        .eq("id", existingNoteId);
      toast({ title: "Note updated" });
    } else {
      // Insert new - handle date range
      const endDate = selectedNoteEndDate || selectedNoteDate;
      const datesToAdd = eachDayOfInterval({ start: selectedNoteDate, end: endDate });
      
      const notesToInsert = datesToAdd.map(date => ({
        teacher_name: selectedNoteTeacher.name,
        maktab: selectedNoteTeacher.maktab,
        date: format(date, "yyyy-MM-dd"),
        note: noteText || "",
        note_type: noteType,
      }));
      
      // Filter out dates that already have notes
      const existingDates = notes
        .filter(n => n.teacher_name === selectedNoteTeacher.name && n.maktab === selectedNoteTeacher.maktab)
        .map(n => n.date);
      
      const newNotes = notesToInsert.filter(n => !existingDates.includes(n.date));
      
      if (newNotes.length === 0) {
        toast({ title: "All dates already have notes", variant: "destructive" });
        setNoteDialogOpen(false);
        return;
      }
      
      await supabase.from("teacher_attendance_notes").insert(newNotes);
      toast({ title: `Added ${newNotes.length} note${newNotes.length > 1 ? 's' : ''}` });
    }
    
    setNoteDialogOpen(false);
    loadNotes();
  };

  const deleteNote = async () => {
    if (!existingNoteId) return;
    await supabase.from("teacher_attendance_notes").delete().eq("id", existingNoteId);
    toast({ title: "Note deleted" });
    setNoteDialogOpen(false);
    loadNotes();
  };

  const confirmDeletePeriod = async () => {
    if (!deletePeriodConfirm) return;
    
    const { teacherName, maktab, startDate, endDate, noteType } = deletePeriodConfirm;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const datesToDelete = eachDayOfInterval({ start, end });
    
    const { error } = await supabase
      .from("teacher_attendance_notes")
      .delete()
      .eq("teacher_name", teacherName)
      .eq("maktab", maktab)
      .eq("note_type", noteType)
      .in("date", datesToDelete.map(d => format(d, "yyyy-MM-dd")));

    if (error) {
      toast({ title: "Error deleting period", variant: "destructive" });
      setDeletePeriodConfirm(null);
      return;
    }

    // Also delete attendance records for this period
    await supabase
      .from("teacher_attendance")
      .delete()
      .eq("teacher_name", teacherName)
      .eq("maktab", maktab)
      .in("date", datesToDelete.map(d => format(d, "yyyy-MM-dd")));

    toast({ title: `Deleted ${datesToDelete.length} day${datesToDelete.length > 1 ? 's' : ''} of ${NOTE_TYPE_CONFIG[noteType].label.toLowerCase()}` });
    setDeletePeriodConfirm(null);
    loadNotes();
  };

  const loadTeacherTargetDays = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "teacher_target_days")
      .single();
    
    if (data?.value && typeof data.value === "object") {
      setTeacherTargetDays(data.value as Record<string, string[]>);
    }
  };

  const getTeacherKey = (teacherName: string, maktab: string) => `${teacherName}_${maktab}`;

  const getTargetDaysForTeacher = (teacherName: string, maktab: string) => {
    const key = getTeacherKey(teacherName, maktab);
    return teacherTargetDays[key] || DEFAULT_TARGET_DAYS;
  };

  const saveTeacherTargetDays = async () => {
    if (!editingTeacher) return;
    
    const newTargetDays = { ...teacherTargetDays, [editingTeacher]: tempTargetDays };
    
    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "teacher_target_days",
        value: newTargetDays,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

    if (error) {
      toast({ title: "Error saving settings", variant: "destructive" });
    } else {
      setTeacherTargetDays(newTargetDays);
      setEditingTeacher(null);
      toast({ title: "Target days updated" });
    }
  };

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate(paths.auth());
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      toast({
        title: "Access Denied",
        description: "You do not have admin privileges",
        variant: "destructive",
      });
      navigate(paths.home());
      return;
    }

    setIsAdmin(true);
    setLoading(false);
  };

  const toggleTeacher = (key: string) => {
    setExpandedTeachers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleExportCSV = () => {
    const csv = generateTeacherAttendanceCSV(teachers, selectedMonth, maktabFilter, notes);
    const monthStr = format(selectedMonth, "MMMM-yyyy").toLowerCase();
    downloadCSV(csv, `teacher-attendance-${monthStr}.csv`);
    toast({
      title: "CSV Downloaded",
      description: "Teacher attendance report has been downloaded",
    });
  };

  const handleEditTargetDays = (teacherName: string, maktab: string) => {
    const key = getTeacherKey(teacherName, maktab);
    setTempTargetDays(getTargetDaysForTeacher(teacherName, maktab));
    setEditingTeacher(key);
  };

  // Generate month options (current month back to December 2024)
  const minDate = new Date(2025, 11, 1); // December 2025
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy"),
      date,
    };
  }).filter(option => option.date >= minDate);

  const renderTeacherSection = (
    sectionTeachers: TeacherAttendanceData[],
    title: string,
    badgeVariant: "boys" | "girls"
  ) => {
    if (sectionTeachers.length === 0) return null;

    const sectionTotalDays = sectionTeachers.reduce((sum, t) => sum + t.daysCount, 0);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Badge
              className={
                badgeVariant === "boys"
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                  : "bg-pink-100 text-pink-700 hover:bg-pink-100"
              }
            >
              {sectionTeachers.length} teachers
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">{sectionTotalDays} total days</span>
        </div>
        {sectionTeachers.map((teacher) => {
          const key = `${teacher.teacherName}-${teacher.maktab}`;
          return (
            <TeacherCard
              key={key}
              teacher={teacher}
              isExpanded={expandedTeachers.has(key)}
              onToggle={() => toggleTeacher(key)}
              selectedMonth={selectedMonth}
              targetDays={getTargetDaysForTeacher(teacher.teacherName, teacher.maktab)}
              onEditTargetDays={() => handleEditTargetDays(teacher.teacherName, teacher.maktab)}
              notes={getNotesForTeacher(teacher.teacherName, teacher.maktab)}
              onDayClick={(date) => handleDayClick(teacher.teacherName, teacher.maktab, date)}
              onDeletePeriod={(startDate, endDate, noteType) => setDeletePeriodConfirm({ teacherName: teacher.teacherName, maktab: teacher.maktab, startDate, endDate, noteType })}
              holidays={holidays}
            />
          );
        })}
      </div>
    );
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

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 safe-top safe-bottom">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to={paths.admin()}>
              <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              Teacher Attendance
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isLoading} className="h-8 sm:h-9 px-2 sm:px-3">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Link to={paths.home()}>
              <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
                <Home className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select
            value={format(selectedMonth, "yyyy-MM")}
            onValueChange={(value) => {
              const option = monthOptions.find((o) => o.value === value);
              if (option) setSelectedMonth(option.date);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={maktabFilter} onValueChange={(v) => setMaktabFilter(v as typeof maktabFilter)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="boys">Boys</SelectItem>
              <SelectItem value="girls">Girls</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHolidaysDialogOpen(true)}
            className="h-9"
          >
            <CalendarOff className="h-4 w-4 mr-2" />
            Holidays
            {holidays.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {holidays.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Banner Settings */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Quick Attendance Banner</span>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="boys-banner"
                  checked={bannerSettings.boys}
                  onCheckedChange={(checked) => saveBannerSettings("boys", checked)}
                />
                <Label htmlFor="boys-banner" className="text-sm">Boys Maktab</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="girls-banner"
                  checked={bannerSettings.girls}
                  onCheckedChange={(checked) => saveBannerSettings("girls", checked)}
                />
                <Label htmlFor="girls-banner" className="text-sm">Girls Maktab</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">{totalDays}</div>
              <div className="text-sm text-muted-foreground">Total Days</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">{averageDays.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Avg per Teacher</div>
            </CardContent>
          </Card>
        </div>

        {/* Teachers List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : teachers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No attendance records found for {format(selectedMonth, "MMMM yyyy")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {(maktabFilter === "all" || maktabFilter === "boys") &&
              renderTeacherSection(boysTeachers, "Boys Maktab", "boys")}
            {(maktabFilter === "all" || maktabFilter === "girls") &&
              renderTeacherSection(girlsTeachers, "Girls Maktab", "girls")}
          </div>
        )}

        {/* Per-teacher target days dialog */}
        <Dialog open={!!editingTeacher} onOpenChange={(open) => !open && setEditingTeacher(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Set Target Days for {editingTeacher?.split("_")[0]}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Select the days this teacher is expected to teach.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {WEEKDAYS.filter(d => d !== "Friday" && d !== "Saturday" && d !== "Sunday").map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${day}`}
                      checked={tempTargetDays.includes(day)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setTempTargetDays([...tempTargetDays, day]);
                        } else {
                          setTempTargetDays(tempTargetDays.filter(d => d !== day));
                        }
                      }}
                    />
                    <label htmlFor={`edit-${day}`} className="text-sm font-medium cursor-pointer">
                      {day}
                    </label>
                  </div>
                ))}
              </div>
              <Button onClick={saveTeacherTargetDays} className="w-full">
                Save Target Days
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Day notes dialog */}
        <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedNoteDate && selectedNoteTeacher && (
                  existingNoteId 
                    ? <>Edit note for {selectedNoteTeacher.name}</>
                    : <>Add note for {selectedNoteTeacher.name}</>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Date range - only show when adding new */}
              {!existingNoteId && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Start Date</Label>
                    <Input
                      type="date"
                      value={selectedNoteDate ? format(selectedNoteDate, "yyyy-MM-dd") : ""}
                      onChange={(e) => setSelectedNoteDate(e.target.value ? parseISO(e.target.value) : null)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End Date (optional)</Label>
                    <Input
                      type="date"
                      value={selectedNoteEndDate ? format(selectedNoteEndDate, "yyyy-MM-dd") : ""}
                      onChange={(e) => setSelectedNoteEndDate(e.target.value ? parseISO(e.target.value) : null)}
                      min={selectedNoteDate ? format(selectedNoteDate, "yyyy-MM-dd") : ""}
                    />
                  </div>
                </div>
              )}
              {existingNoteId && selectedNoteDate && (
                <div className="text-sm text-muted-foreground">
                  {format(selectedNoteDate, "EEEE, d MMMM yyyy")}
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">
                      <span className="flex items-center gap-2">
                        <Palmtree className="h-4 w-4 text-orange-600" /> Leave
                      </span>
                    </SelectItem>
                    <SelectItem value="sickness">
                      <span className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-red-600" /> Sickness
                      </span>
                    </SelectItem>
                    <SelectItem value="other">
                      <span className="flex items-center gap-2">
                        <StickyNote className="h-4 w-4 text-yellow-600" /> Other
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={noteType === "other" ? "Note required for 'Other' type..." : "Add a note..."}
                  className={`min-h-[80px] ${noteType === "other" && !noteText.trim() ? "border-destructive" : ""}`}
                />
                {noteType === "other" && !noteText.trim() && (
                  <p className="text-xs text-destructive">A note is required when selecting "Other"</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={saveNote} className="flex-1">
                  {existingNoteId ? "Update" : "Save"} Note{!existingNoteId && selectedNoteEndDate && selectedNoteEndDate > selectedNoteDate! ? 's' : ''}
                </Button>
                {existingNoteId && (
                  <Button variant="destructive" size="icon" onClick={deleteNote}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Holidays dialog */}
        <Dialog open={holidaysDialogOpen} onOpenChange={setHolidaysDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarOff className="h-5 w-5" />
                School Holidays
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Add school closure dates. These days will be greyed out for all teachers and won't count towards their targets.
              </p>
              
              {/* Add new holiday */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="holiday-start" className="text-xs">Start Date</Label>
                    <Input
                      id="holiday-start"
                      type="date"
                      value={newHolidayStartDate}
                      onChange={(e) => setNewHolidayStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="holiday-end" className="text-xs">End Date (optional)</Label>
                    <Input
                      id="holiday-end"
                      type="date"
                      value={newHolidayEndDate}
                      onChange={(e) => setNewHolidayEndDate(e.target.value)}
                      min={newHolidayStartDate}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="holiday-reason" className="text-xs">Reason</Label>
                  <Input
                    id="holiday-reason"
                    placeholder="e.g. Eid, Half Term"
                    value={newHolidayReason}
                    onChange={(e) => setNewHolidayReason(e.target.value)}
                  />
                </div>
                <Button onClick={addHoliday} disabled={!newHolidayStartDate} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holiday{newHolidayEndDate && newHolidayEndDate !== newHolidayStartDate ? 's' : ''}
                </Button>
              </div>
              
              {/* List of holidays - grouped by consecutive dates with same reason */}
              {holidays.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <div className="text-xs font-medium text-muted-foreground">Saved holidays</div>
                  {(() => {
                    // Group consecutive holidays with same reason
                    const groups: { start: string; end: string; reason: string; dates: string[] }[] = [];
                    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
                    
                    sorted.forEach((holiday) => {
                      const lastGroup = groups[groups.length - 1];
                      if (lastGroup && lastGroup.reason === holiday.reason) {
                        // Check if this date is consecutive (1 day after the end)
                        const lastEnd = parseISO(lastGroup.end);
                        const currentDate = parseISO(holiday.date);
                        const diff = (currentDate.getTime() - lastEnd.getTime()) / (1000 * 60 * 60 * 24);
                        if (diff === 1) {
                          lastGroup.end = holiday.date;
                          lastGroup.dates.push(holiday.date);
                          return;
                        }
                      }
                      // Start a new group
                      groups.push({
                        start: holiday.date,
                        end: holiday.date,
                        reason: holiday.reason,
                        dates: [holiday.date],
                      });
                    });
                    
                    return groups.map((group) => (
                      <div
                        key={`${group.start}-${group.end}`}
                        className="flex items-center justify-between p-2 rounded border bg-muted/50"
                      >
                        <div>
                          <div className="font-medium text-sm">
                            {group.start === group.end
                              ? format(parseISO(group.start), "EEEE, d MMMM yyyy")
                              : `${format(parseISO(group.start), "d MMM")} - ${format(parseISO(group.end), "d MMM yyyy")}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {group.reason}
                            {group.dates.length > 1 && ` (${group.dates.length} days)`}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={async () => {
                            // Remove all dates in this group
                            const updatedHolidays = holidays.filter(h => !group.dates.includes(h.date));
                            await saveHolidays(updatedHolidays);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ));
                  })()}
                </div>
              )}
              
              {holidays.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  No holidays added yet
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Period Confirmation Dialog */}
        <AlertDialog open={!!deletePeriodConfirm} onOpenChange={(open) => !open && setDeletePeriodConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Leave Period?</AlertDialogTitle>
              <AlertDialogDescription>
                {deletePeriodConfirm && (
                  <>
                    This will delete the{" "}
                    <span className="font-medium">{NOTE_TYPE_CONFIG[deletePeriodConfirm.noteType].label.toLowerCase()}</span>{" "}
                    period from{" "}
                    <span className="font-medium">{format(parseISO(deletePeriodConfirm.startDate), "MMM d, yyyy")}</span>
                    {deletePeriodConfirm.startDate !== deletePeriodConfirm.endDate && (
                      <> to <span className="font-medium">{format(parseISO(deletePeriodConfirm.endDate), "MMM d, yyyy")}</span></>
                    )}{" "}
                    for <span className="font-medium">{deletePeriodConfirm.teacherName}</span>. This action cannot be undone.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeletePeriod} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default TeacherAttendance;
