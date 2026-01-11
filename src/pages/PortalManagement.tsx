import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { SendPortalInviteButton } from "@/components/admin/SendPortalInviteButton";
import { ManageParentLinksDialog } from "@/components/admin/ManageParentLinksDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Home, ArrowLeft, Users, UserCheck, UserX, Search, Mail, Send, Pencil, Trash2, X, Ghost, Download, Link2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { paths, isPortalDomain } from "@/lib/portalPaths";
import { useParentGhostMode } from "@/contexts/ParentGhostModeContext";

interface ParentRegistration {
  parent_id: string;
  parent_email: string;
  parent_name: string | null;
  registered_at: string;
  students: Array<{
    id: string;
    name: string;
    student_code: string | null;
    maktab: string;
  }>;
}

interface StudentWithPortalStatus {
  id: string;
  name: string;
  student_code: string | null;
  guardian_email: string | null;
  billing_email: string | null;
  maktab: string;
  status: string;
  has_portal_access: boolean;
  parent_registered_at: string | null;
  portal_invite_email: string | null;
  portal_invite_sent_at: string | null;
}

export default function PortalManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { enterGhostMode } = useParentGhostMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "registered" | "not_registered">("all");
  const [maktabFilter, setMaktabFilter] = useState<"all" | "boys" | "girls">("all");
  const [parentMaktabFilter, setParentMaktabFilter] = useState<"all" | "boys" | "girls">("all");
  const [parentSearchQuery, setParentSearchQuery] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentWithPortalStatus | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [deletingParent, setDeletingParent] = useState<ParentRegistration | null>(null);
  const isMobile = useIsMobile();

  const handleViewAsParent = (parent: ParentRegistration) => {
    enterGhostMode({
      id: parent.parent_id,
      email: parent.parent_email,
      full_name: parent.parent_name,
    });
    // Navigate to parent portal
    const portalPath = isPortalDomain ? "/" : "/portal";
    navigate(portalPath);
  };

  // Fetch all students with portal status
  const { data: studentsData, isLoading: studentsLoading, refetch: refetchStudents } = useQuery({
    queryKey: ["students-portal-status"],
    queryFn: async () => {
      // Get all active students
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, name, student_code, guardian_email, billing_email, maktab, status, portal_invite_email, portal_invite_sent_at")
        .eq("status", "active")
        .order("name");

      if (studentsError) throw studentsError;

      // Get all parent-student links
      const { data: links, error: linksError } = await supabase
        .from("parent_student_links")
        .select("student_id, parent_id, verified_at, created_at")
        .not("verified_at", "is", null);

      if (linksError) throw linksError;

      // Map students to their portal status
      const studentMap = new Map<string, StudentWithPortalStatus>();
      
      for (const student of students || []) {
        const link = links?.find(l => l.student_id === student.id);
        studentMap.set(student.id, {
          ...student,
          has_portal_access: !!link,
          parent_registered_at: link?.verified_at || null,
        });
      }

      return Array.from(studentMap.values());
    },
  });

  // Fetch registered parents
  const { data: parentsData, isLoading: parentsLoading, refetch: refetchParents } = useQuery({
    queryKey: ["registered-parents"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("parent_profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const parentIds = profiles?.map(p => p.id) || [];
      
      if (parentIds.length === 0) return [];

      const { data: links, error: linksError } = await supabase
        .from("parent_student_links")
        .select("parent_id, student_id, students(id, name, student_code, maktab)")
        .in("parent_id", parentIds);

      if (linksError) throw linksError;

      // Group by parent
      const parentMap = new Map<string, ParentRegistration>();
      
      for (const profile of profiles || []) {
        const studentLinks = links?.filter(l => l.parent_id === profile.id) || [];
        parentMap.set(profile.id, {
          parent_id: profile.id,
          parent_email: profile.email,
          parent_name: profile.full_name,
          registered_at: profile.created_at,
          students: studentLinks.map(l => ({
            id: (l.students as any)?.id || "",
            name: (l.students as any)?.name || "Unknown",
            student_code: (l.students as any)?.student_code || null,
            maktab: (l.students as any)?.maktab || "unknown",
          })),
        });
      }

      return Array.from(parentMap.values());
    },
  });

  // Delete parent mutation
  const deleteParentMutation = useMutation({
    mutationFn: async (parentId: string) => {
      // Delete parent_student_links first
      const { error: linksError } = await supabase
        .from("parent_student_links")
        .delete()
        .eq("parent_id", parentId);
      if (linksError) throw linksError;

      // Delete parent_notifications
      const { error: notificationsError } = await supabase
        .from("parent_notifications")
        .delete()
        .eq("parent_id", parentId);
      if (notificationsError) throw notificationsError;

      // Delete parent_profile
      const { error: profileError } = await supabase
        .from("parent_profiles")
        .delete()
        .eq("id", parentId);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registered-parents"] });
      queryClient.invalidateQueries({ queryKey: ["students-portal-status"] });
      toast({ title: "Parent registration deleted successfully" });
      setDeletingParent(null);
    },
    onError: (error) => {
      toast({ 
        title: "Failed to delete parent registration", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Filter students
  const filteredStudents = studentsData?.filter(student => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        student.name.toLowerCase().includes(query) ||
        student.student_code?.toLowerCase().includes(query) ||
        student.guardian_email?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter === "registered" && !student.has_portal_access) return false;
    if (statusFilter === "not_registered" && student.has_portal_access) return false;

    // Maktab filter
    if (maktabFilter !== "all" && student.maktab !== maktabFilter) return false;

    return true;
  }) || [];

  // Stats
  const totalStudents = studentsData?.length || 0;
  const registeredCount = studentsData?.filter(s => s.has_portal_access).length || 0;
  const notRegisteredCount = totalStudents - registeredCount;
  const withEmailCount = studentsData?.filter(s => s.guardian_email || s.billing_email || s.portal_invite_email).length || 0;

  // Update email mutation
  const updateEmailMutation = useMutation({
    mutationFn: async ({ studentId, email }: { studentId: string; email: string | null }) => {
      const { error } = await supabase
        .from("students")
        .update({ guardian_email: email })
        .eq("id", studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students-portal-status"] });
      toast({ title: "Email updated successfully" });
      setEditingStudent(null);
      setEditEmail("");
    },
    onError: () => {
      toast({ title: "Failed to update email", variant: "destructive" });
    },
  });

  const handleEditEmail = (student: StudentWithPortalStatus) => {
    setEditingStudent(student);
    setEditEmail(student.guardian_email || student.billing_email || student.portal_invite_email || "");
  };

  const handleSaveEmail = () => {
    if (!editingStudent) return;
    const trimmedEmail = editEmail.trim();
    updateEmailMutation.mutate({ 
      studentId: editingStudent.id, 
      email: trimmedEmail || null 
    });
  };

  const handleRemoveEmail = () => {
    if (!editingStudent) return;
    updateEmailMutation.mutate({ studentId: editingStudent.id, email: null });
  };

  // Bulk send invites - uses guardian_email first, then billing_email
  // Only sends to students who haven't been invited in the past 30 days
  const handleBulkSendInvites = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const eligibleStudents = filteredStudents.filter(s => {
      // Must not have portal access and must have an email
      if (s.has_portal_access || !(s.guardian_email || s.billing_email)) {
        return false;
      }
      // Skip if invited within the last 30 days
      if (s.portal_invite_sent_at) {
        const invitedAt = new Date(s.portal_invite_sent_at);
        if (invitedAt > thirtyDaysAgo) {
          return false;
        }
      }
      return true;
    });

    if (eligibleStudents.length === 0) {
      toast({ title: "No eligible students to invite (all were invited within the last 30 days)", variant: "destructive" });
      return;
    }

    setBulkSending(true);
    let successCount = 0;
    let failCount = 0;

    for (const student of eligibleStudents) {
      try {
        // Use guardian_email first, then billing_email, then portal_invite_email
        const emailToUse = student.guardian_email || student.billing_email || student.portal_invite_email;
        const { error } = await supabase.functions.invoke("send-parent-magic-link", {
          body: { 
            student_code: student.student_code,
            email_override: emailToUse 
          },
        });
        if (error) {
          console.error(`Failed to send invite for ${student.name}:`, error);
          failCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Error sending invite for ${student.name}:`, err);
        failCount++;
      }
    }

    setBulkSending(false);
    refetchStudents();
    toast({
      title: `Bulk invites sent`,
      description: `${successCount} successful, ${failCount} failed`,
    });
  };

  // Export unregistered parents to CSV
  const handleExportUnregisteredCSV = () => {
    const unregisteredStudents = studentsData?.filter(s => !s.has_portal_access) || [];
    
    if (unregisteredStudents.length === 0) {
      toast({ title: "No unregistered students to export", variant: "destructive" });
      return;
    }

    const boysStudents = unregisteredStudents.filter(s => s.maktab === "boys");
    const girlsStudents = unregisteredStudents.filter(s => s.maktab === "girls");

    // Build CSV content with sections
    const headers = ["Student Name", "Student Code", "Email"];
    const rows: string[] = [];
    
    // Boys section
    rows.push("BOYS MAKTAB");
    rows.push(headers.join(","));
    boysStudents.forEach(s => {
      rows.push([
        `"${(s.name || "").replace(/"/g, '""')}"`,
        `"${(s.student_code || "").replace(/"/g, '""')}"`,
        `"${(s.guardian_email || s.billing_email || s.portal_invite_email || "").replace(/"/g, '""')}"`
      ].join(","));
    });
    rows.push(`Total: ${boysStudents.length}`);
    rows.push("");
    
    // Girls section
    rows.push("GIRLS MAKTAB");
    rows.push(headers.join(","));
    girlsStudents.forEach(s => {
      rows.push([
        `"${(s.name || "").replace(/"/g, '""')}"`,
        `"${(s.student_code || "").replace(/"/g, '""')}"`,
        `"${(s.guardian_email || s.billing_email || s.portal_invite_email || "").replace(/"/g, '""')}"`
      ].join(","));
    });
    rows.push(`Total: ${girlsStudents.length}`);

    const csvContent = rows.join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `unregistered-parents-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: `Exported ${unregisteredStudents.length} unregistered students (${boysStudents.length} boys, ${girlsStudents.length} girls)` });
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 safe-top safe-bottom">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to={paths.admin()}>
              <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold">Portal Management</h1>
          </div>
          <Link to={paths.home()}>
            <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
              <Home className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{totalStudents}</p>
                  <p className="text-xs text-muted-foreground">Total Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-success" />
                <div>
                  <p className="text-2xl font-bold text-success">{registeredCount}</p>
                  <p className="text-xs text-muted-foreground">Registered</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-warning" />
                <div>
                  <p className="text-2xl font-bold text-warning">{notRegisteredCount}</p>
                  <p className="text-xs text-muted-foreground">Not Registered</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-primary">{withEmailCount}</p>
                  <p className="text-xs text-muted-foreground">Have Email</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Registered Parents */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Registered Parents</CardTitle>
                <CardDescription>
                  Parents who have created portal accounts
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={parentMaktabFilter} onValueChange={(v) => setParentMaktabFilter(v as typeof parentMaktabFilter)}>
                  <SelectTrigger className="w-[100px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="boys">Boys</SelectItem>
                    <SelectItem value="girls">Girls</SelectItem>
                  </SelectContent>
                </Select>
                <ManageParentLinksDialog
                  trigger={
                    <Button variant="outline" size="sm">
                      <Link2 className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Manage Links</span>
                    </Button>
                  }
                />
              </div>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or student..."
                value={parentSearchQuery}
                onChange={(e) => setParentSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {parentsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : parentsData?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No parents have registered yet
              </div>
            ) : (
              <div className="space-y-2">
                {parentsData
                  ?.filter(parent => {
                    // Search filter
                    if (parentSearchQuery) {
                      const query = parentSearchQuery.toLowerCase();
                      const matchesSearch = 
                        parent.parent_email.toLowerCase().includes(query) ||
                        parent.parent_name?.toLowerCase().includes(query) ||
                        parent.students.some(s => 
                          s.name.toLowerCase().includes(query) || 
                          s.student_code?.toLowerCase().includes(query)
                        );
                      if (!matchesSearch) return false;
                    }
                    // Maktab filter
                    if (parentMaktabFilter === "all") return true;
                    return parent.students.some(s => s.maktab === parentMaktabFilter);
                  })
                  .map(parent => (
                  <div
                    key={parent.parent_id}
                    className="p-3 border rounded-lg bg-card"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {parent.parent_name || parent.parent_email}
                        </p>
                        <p className="text-xs text-muted-foreground">{parent.parent_email}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-muted-foreground mr-1">
                          {format(new Date(parent.registered_at), "d MMM yyyy")}
                        </p>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                          onClick={() => handleViewAsParent(parent)}
                          title="View as parent (Ghost Mode)"
                        >
                          <Ghost className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeletingParent(parent)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Parent Registration</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the registration for{" "}
                                <strong>{parent.parent_name || parent.parent_email}</strong>.
                                The parent will need to re-register to access the portal again.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteParentMutation.mutate(parent.parent_id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deleteParentMutation.isPending ? "Deleting..." : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    {parent.students.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {parent.students.map(student => (
                          <Badge key={student.id} variant="outline" className="text-xs">
                            {student.name} ({student.student_code})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Students List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Student Portal Status</CardTitle>
                <CardDescription className="text-sm">
                  Send invites and track parent registrations
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  onClick={handleExportUnregisteredCSV}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Unregistered
                </Button>
                <Button
                  onClick={handleBulkSendInvites}
                  disabled={bulkSending}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {bulkSending ? "Sending..." : "Bulk Send Invites (not invited in 30 days)"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, code, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="registered">Registered</SelectItem>
                    <SelectItem value="not_registered">Not Registered</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={maktabFilter} onValueChange={(v) => setMaktabFilter(v as any)}>
                  <SelectTrigger className="w-full sm:w-[100px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="boys">Boys</SelectItem>
                    <SelectItem value="girls">Girls</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results */}
            <div className="text-xs text-muted-foreground">
              {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}
            </div>

            {/* Student List */}
            {studentsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students found
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{student.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {student.student_code}
                        </Badge>
                        <Badge 
                          variant={student.has_portal_access ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {student.has_portal_access ? "Registered" : "Not Registered"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {(student.guardian_email || student.billing_email || student.portal_invite_email) ? (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {student.guardian_email || student.billing_email || student.portal_invite_email}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No email</p>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleEditEmail(student)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                      {student.portal_invite_sent_at && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Invite sent: {format(new Date(student.portal_invite_sent_at), "d MMM yyyy HH:mm")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {!student.has_portal_access && student.student_code && (
                        <SendPortalInviteButton
                          studentCode={student.student_code}
                          studentName={student.name}
                          guardianEmail={student.guardian_email || student.billing_email || student.portal_invite_email}
                          lastInviteEmail={student.portal_invite_email}
                          lastInviteSentAt={student.portal_invite_sent_at}
                          onInviteSent={() => refetchStudents()}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Edit Email Dialog */}
            <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Email</DialogTitle>
                  <DialogDescription>
                    Update the guardian email for {editingStudent?.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email Address</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      placeholder="parent@example.com"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  {(editingStudent?.guardian_email || editingStudent?.portal_invite_email) && (
                    <Button
                      variant="destructive"
                      onClick={handleRemoveEmail}
                      disabled={updateEmailMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Email
                    </Button>
                  )}
                  <div className="flex gap-2 w-full sm:w-auto">
                    <DialogClose asChild>
                      <Button variant="outline" className="flex-1 sm:flex-none">Cancel</Button>
                    </DialogClose>
                    <Button 
                      onClick={handleSaveEmail} 
                      disabled={updateEmailMutation.isPending}
                      className="flex-1 sm:flex-none"
                    >
                      Save
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
