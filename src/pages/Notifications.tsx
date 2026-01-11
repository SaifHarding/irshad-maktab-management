import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Bell, BellOff, Plus, Trash2, Calendar, Clock, Mail, Send, FileText, Edit2, Home } from "lucide-react";
import {
  useTeacherReminders,
  useMutePeriods,
  useSaveReminder,
  useUpdateReminder,
  useDeleteReminder,
  useSaveMutePeriod,
  useDeleteMutePeriod,
  TeacherReminder,
  ReminderMutePeriod,
} from "@/hooks/useTeacherReminders";
import { format } from "date-fns";
import { paths } from "@/lib/portalPaths";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const Notifications = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingTestId, setSendingTestId] = useState<string | null>(null);
  const [sendingMonthlyReport, setSendingMonthlyReport] = useState<"boys" | "girls" | null>(null);

  // Reminder dialog state
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<TeacherReminder | null>(null);
  const [reminderForm, setReminderForm] = useState({
    teacher_name: "",
    maktab: "girls" as string,
    reminder_time: "16:00",
    reminder_days: ["Monday", "Tuesday", "Wednesday", "Thursday"] as string[],
    notification_email: "",
    is_active: true,
  });

  // Mute period dialog state
  const [muteDialogOpen, setMuteDialogOpen] = useState(false);
  const [muteForm, setMuteForm] = useState({
    maktab: "" as string,
    teacher_name: "" as string,
    start_date: "",
    end_date: "",
    reason: "",
  });

  const { data: reminders, isLoading: remindersLoading, isFetching: remindersFetching } = useTeacherReminders();
  const { data: mutePeriods, isLoading: mutePeriodsLoading, isFetching: mutePeriodsFetching } = useMutePeriods();
  const saveReminder = useSaveReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();
  const saveMutePeriod = useSaveMutePeriod();
  const deleteMutePeriod = useDeleteMutePeriod();

  // Fetch head teachers for monthly reports
  const { data: headTeachers } = useQuery({
    queryKey: ["head-teachers-for-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, maktab")
        .eq("is_head_teacher", true);
      if (error) throw error;
      const result: { boys: { name: string; email: string } | null; girls: { name: string; email: string } | null } = { 
        boys: null, 
        girls: null 
      };
      data?.forEach((ht) => {
        if (ht.maktab === "boys") result.boys = { name: ht.full_name || "Head Teacher", email: ht.email || "" };
        if (ht.maktab === "girls") result.girls = { name: ht.full_name || "Head Teacher", email: ht.email || "" };
      });
      return result;
    },
  });

  // Fetch teachers from profiles
  const { data: teachers } = useQuery({
    queryKey: ["teachers-for-reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, maktab")
        .not("full_name", "is", null)
        .order("full_name");
      if (error) throw error;
      return data as { full_name: string; maktab: string | null }[];
    },
  });

  // Filter teachers by selected maktab
  const filteredTeachers = useMemo(() => {
    if (!teachers) return [];
    return teachers.filter((t) => t.maktab === reminderForm.maktab);
  }, [teachers, reminderForm.maktab]);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate(paths.auth());
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasAdmin = roles?.some((r) => r.role === "admin");
    if (!hasAdmin) {
      navigate(paths.home());
      return;
    }

    setIsAdmin(true);
    setLoading(false);
  };

  const handleSaveReminder = async () => {
    if (!reminderForm.teacher_name || !reminderForm.notification_email) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    try {
      if (editingReminder) {
        await updateReminder.mutateAsync({
          id: editingReminder.id,
          ...reminderForm,
        });
        toast({ title: "Reminder updated" });
      } else {
        await saveReminder.mutateAsync(reminderForm);
        toast({ title: "Reminder created" });
      }
      setReminderDialogOpen(false);
      resetReminderForm();
    } catch (error: any) {
      toast({ title: "Error saving reminder", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteReminder.mutateAsync(id);
      toast({ title: "Reminder deleted" });
    } catch (error: any) {
      toast({ title: "Error deleting reminder", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleReminder = async (reminder: TeacherReminder) => {
    try {
      await updateReminder.mutateAsync({
        id: reminder.id,
        is_active: !reminder.is_active,
      });
      toast({ title: reminder.is_active ? "Reminder disabled" : "Reminder enabled" });
    } catch (error: any) {
      toast({ title: "Error updating reminder", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveMutePeriod = async () => {
    if (!muteForm.start_date || !muteForm.end_date || !muteForm.reason) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    try {
      await saveMutePeriod.mutateAsync({
        maktab: muteForm.maktab || null,
        teacher_name: muteForm.teacher_name || null,
        start_date: muteForm.start_date,
        end_date: muteForm.end_date,
        reason: muteForm.reason,
      });
      toast({ title: "Mute period created" });
      setMuteDialogOpen(false);
      resetMuteForm();
    } catch (error: any) {
      toast({ title: "Error saving mute period", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteMutePeriod = async (id: string) => {
    try {
      await deleteMutePeriod.mutateAsync(id);
      toast({ title: "Mute period deleted" });
    } catch (error: any) {
      toast({ title: "Error deleting mute period", description: error.message, variant: "destructive" });
    }
  };

  const handleSendTestReminder = async (reminder: TeacherReminder) => {
    setSendingTestId(reminder.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-teacher-reminders", {
        body: { test_reminder_id: reminder.id },
      });
      
      if (error) throw error;
      
      const result = data?.results?.[0];
      if (result?.status === "sent") {
        toast({ title: "Test email sent!", description: `Reminder sent to ${reminder.notification_email}` });
      } else if (result?.status === "error") {
        toast({ title: "Failed to send", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Unexpected result", description: JSON.stringify(data), variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error sending test", description: error.message, variant: "destructive" });
    } finally {
      setSendingTestId(null);
    }
  };

  const resetReminderForm = () => {
    setEditingReminder(null);
    setReminderForm({
      teacher_name: "",
      maktab: "girls",
      reminder_time: "16:00",
      reminder_days: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      notification_email: "",
      is_active: true,
    });
  };

  const resetMuteForm = () => {
    setMuteForm({
      maktab: "",
      teacher_name: "",
      start_date: "",
      end_date: "",
      reason: "",
    });
  };

  const handleSendMonthlyReport = async (maktab: "boys" | "girls") => {
    setSendingMonthlyReport(maktab);
    try {
      const { data, error } = await supabase.functions.invoke("send-attendance-report", {
        body: { maktab },
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast({ title: "Report sent!", description: data.message });
      } else {
        toast({ title: "Note", description: data?.error || data?.message || "No data to report", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error sending report", description: error.message, variant: "destructive" });
    } finally {
      setSendingMonthlyReport(null);
    }
  };

  const openEditReminder = (reminder: TeacherReminder) => {
    setEditingReminder(reminder);
    setReminderForm({
      teacher_name: reminder.teacher_name,
      maktab: reminder.maktab,
      reminder_time: reminder.reminder_time,
      reminder_days: reminder.reminder_days,
      notification_email: reminder.notification_email,
      is_active: reminder.is_active,
    });
    setReminderDialogOpen(true);
  };

  const toggleDay = (day: string) => {
    setReminderForm((prev) => ({
      ...prev,
      reminder_days: prev.reminder_days.includes(day)
        ? prev.reminder_days.filter((d) => d !== day)
        : [...prev.reminder_days, day],
    }));
  };

  // Only show full-page loading on initial load, not during background refetches
  const isInitialLoading = loading || (remindersLoading && !reminders) || (mutePeriodsLoading && !mutePeriods);
  
  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const uniqueTeachers = Array.from(new Set(reminders?.map((r) => r.teacher_name) || []));

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 safe-top safe-bottom">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
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
              <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
              Notifications
            </h1>
          </div>
          <Link to={paths.home()}>
            <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
              <Home className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </Link>
        </div>

        {/* Monthly Reports Section */}
        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              Monthly Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 pt-0 space-y-3">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Reports are sent to head teachers. Configure head teacher emails in User Management.
            </p>
            
            {/* Girls Maktab */}
            <div className="p-3 border rounded-lg bg-card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">Girls Maktab</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">Monthly</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Mail className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">
                      {headTeachers?.girls?.email 
                        ? `${headTeachers.girls.name} (${headTeachers.girls.email})`
                        : "No head teacher email configured"}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSendMonthlyReport("girls")}
                disabled={sendingMonthlyReport === "girls" || !headTeachers?.girls?.email}
                className="w-full gap-1 h-8"
              >
                <Send className="h-3 w-3" />
                {sendingMonthlyReport === "girls" ? "Sending..." : "Send Now"}
              </Button>
            </div>

            {/* Boys Maktab */}
            <div className="p-3 border rounded-lg bg-card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">Boys Maktab</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Monthly</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Mail className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">
                      {headTeachers?.boys?.email 
                        ? `${headTeachers.boys.name} (${headTeachers.boys.email})`
                        : "No head teacher email configured"}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSendMonthlyReport("boys")}
                disabled={sendingMonthlyReport === "boys" || !headTeachers?.boys?.email}
                className="w-full gap-1 h-8"
              >
                <Send className="h-3 w-3" />
                {sendingMonthlyReport === "boys" ? "Sending..." : "Send Now"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Daily Reminders Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="text-base sm:text-lg">Daily Reminders</CardTitle>
            <Dialog open={reminderDialogOpen} onOpenChange={(open) => {
              setReminderDialogOpen(open);
              if (!open) resetReminderForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 h-8 px-2 sm:px-3">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">{editingReminder ? "Edit Reminder" : "Add Reminder"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Maktab</Label>
                    <Select
                      value={reminderForm.maktab}
                      onValueChange={(value) => setReminderForm((prev) => ({ 
                        ...prev, 
                        maktab: value,
                        teacher_name: teachers?.find(t => t.full_name === prev.teacher_name && t.maktab === value) 
                          ? prev.teacher_name 
                          : ""
                      }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="girls">Girls Maktab</SelectItem>
                        <SelectItem value="boys">Boys Maktab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Teacher Name</Label>
                    <Select
                      value={reminderForm.teacher_name}
                      onValueChange={(value) => setReminderForm((prev) => ({ ...prev, teacher_name: value }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select a teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTeachers.map((teacher) => (
                          <SelectItem key={teacher.full_name} value={teacher.full_name!}>
                            {teacher.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Reminder Time</Label>
                    <Input
                      type="time"
                      value={reminderForm.reminder_time}
                      onChange={(e) => setReminderForm((prev) => ({ ...prev, reminder_time: e.target.value }))}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Reminder Days</Label>
                    <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <label key={day} className="flex items-center gap-1.5 text-xs sm:text-sm">
                          <Checkbox
                            checked={reminderForm.reminder_days.includes(day)}
                            onCheckedChange={() => toggleDay(day)}
                          />
                          {day.slice(0, 3)}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Email Address</Label>
                    <Input
                      type="email"
                      value={reminderForm.notification_email}
                      onChange={(e) => setReminderForm((prev) => ({ ...prev, notification_email: e.target.value }))}
                      placeholder="teacher@example.com"
                      className="h-10"
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <DialogClose asChild>
                    <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleSaveReminder} disabled={saveReminder.isPending || updateReminder.isPending} className="w-full sm:w-auto">
                    {editingReminder ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 pt-0">
            {reminders && reminders.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="p-3 border rounded-lg bg-card space-y-2"
                  >
                    {/* Top row: name, maktab badge, active toggle */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium text-sm truncate">{reminder.teacher_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                          reminder.maktab === "girls" 
                            ? "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" 
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        }`}>
                          {reminder.maktab === "girls" ? "Girls" : "Boys"}
                        </span>
                      </div>
                      <Switch
                        checked={reminder.is_active}
                        onCheckedChange={() => handleToggleReminder(reminder)}
                      />
                    </div>
                    
                    {/* Info row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {reminder.reminder_time}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{reminder.notification_email}</span>
                      </span>
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                      {reminder.reminder_days.map((d) => d.slice(0, 3)).join(", ")}
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleSendTestReminder(reminder)}
                        disabled={sendingTestId === reminder.id}
                        className="flex-1 gap-1 h-8 text-xs"
                      >
                        <Send className="h-3 w-3" />
                        {sendingTestId === reminder.id ? "Sending..." : "Test"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditReminder(reminder)} className="h-8 px-2">
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive h-8 px-2">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-base">Delete Reminder?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm">
                              This will permanently delete the reminder for {reminder.teacher_name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteReminder(reminder.id)} className="w-full sm:w-auto">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6 text-sm">
                No reminders configured. Add one to get started.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Mute Periods Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <BellOff className="h-4 w-4 sm:h-5 sm:w-5" />
              Mute Periods
            </CardTitle>
            <Dialog open={muteDialogOpen} onOpenChange={(open) => {
              setMuteDialogOpen(open);
              if (!open) resetMuteForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1 h-8 px-2 sm:px-3">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">Add Mute Period</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Apply To</Label>
                    <Select
                      value={muteForm.maktab || "all"}
                      onValueChange={(value) => setMuteForm((prev) => ({ ...prev, maktab: value === "all" ? "" : value }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="All Maktabs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Maktabs</SelectItem>
                        <SelectItem value="girls">Girls Maktab</SelectItem>
                        <SelectItem value="boys">Boys Maktab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Teacher</Label>
                    <Select
                      value={muteForm.teacher_name || "all"}
                      onValueChange={(value) => setMuteForm((prev) => ({ ...prev, teacher_name: value === "all" ? "" : value }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="All Teachers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Teachers</SelectItem>
                        {uniqueTeachers.map((teacher) => (
                          <SelectItem key={teacher} value={teacher}>
                            {teacher}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Start Date</Label>
                      <Input
                        type="date"
                        value={muteForm.start_date}
                        onChange={(e) => setMuteForm((prev) => ({ ...prev, start_date: e.target.value }))}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">End Date</Label>
                      <Input
                        type="date"
                        value={muteForm.end_date}
                        onChange={(e) => setMuteForm((prev) => ({ ...prev, end_date: e.target.value }))}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Reason</Label>
                    <Input
                      value={muteForm.reason}
                      onChange={(e) => setMuteForm((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="e.g. Winter Holiday"
                      className="h-10"
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <DialogClose asChild>
                    <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleSaveMutePeriod} disabled={saveMutePeriod.isPending} className="w-full sm:w-auto">
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 pt-0">
            {mutePeriods && mutePeriods.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {mutePeriods.map((mute) => (
                  <div
                    key={mute.id}
                    className="flex items-start justify-between gap-3 p-3 border rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="font-medium text-sm">{mute.reason}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span>{format(new Date(mute.start_date), "MMM d")} - {format(new Date(mute.end_date), "MMM d, yyyy")}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {mute.maktab ? (mute.maktab === "girls" ? "Girls" : "Boys") : "All"} Maktab
                        {mute.teacher_name && ` • ${mute.teacher_name}`}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive h-8 px-2 flex-shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-base">Delete Mute Period?</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm">
                            This will delete the mute period "{mute.reason}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                          <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteMutePeriod(mute.id)} className="w-full sm:w-auto">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6 text-sm">
                No mute periods configured. Add one for holidays.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;