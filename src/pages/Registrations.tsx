import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, X, Calendar, Phone, Mail, MapPin, User, UserPlus, Loader2, History, Clock, Users, AlertCircle, CreditCard, RotateCw, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { usePendingRegistrations, type PendingRegistration, type GroupedRegistrations } from "@/hooks/usePendingRegistrations";
import { usePendingPaymentStudents, type PendingPaymentStudent } from "@/hooks/usePendingPaymentStudents";
import { paths } from "@/lib/portalPaths";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInYears } from "date-fns";
import { getGroupLabel, getGroupCodesForMaktab } from "@/lib/groups";

const calculateAge = (dob: string) => {
  return differenceInYears(new Date(), new Date(dob));
};

const Registrations = () => {
  const { 
    pendingRegistrations, 
    groupedRegistrations,
    isLoading, 
    registrationHistory,
    isLoadingHistory,
    approveRegistration, 
    batchApproveRegistrations,
    rejectRegistration,
    deleteHistoryEntry,
  } = usePendingRegistrations();
  
  const {
    pendingPaymentStudents,
    groupedStudents: groupedPaymentStudents,
    isLoading: isLoadingPayment,
    manualApprove,
    batchManualApprove,
    resendPaymentLink,
    cancelRegistration,
  } = usePendingPaymentStudents();
  
  const [userFullName, setUserFullName] = useState("");
  
  // Single approval dialog state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<PendingRegistration | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  
  // Batch approval dialog state
  const [batchApproveDialogOpen, setBatchApproveDialogOpen] = useState(false);
  const [selectedGroup_batch, setSelectedGroup_batch] = useState<GroupedRegistrations | null>(null);
  const [groupAssignments, setGroupAssignments] = useState<Record<string, string>>({});
  
  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  
  // Pending payment approval dialog
  const [paymentApprovalDialogOpen, setPaymentApprovalDialogOpen] = useState(false);
  const [selectedPaymentStudent, setSelectedPaymentStudent] = useState<PendingPaymentStudent | null>(null);
  const [paymentApprovalReason, setPaymentApprovalReason] = useState("");
  
  // Cancel payment dialog
  const [cancelPaymentDialogOpen, setCancelPaymentDialogOpen] = useState(false);
  const [studentToCancel, setStudentToCancel] = useState<PendingPaymentStudent | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Delete history entry dialog
  const [deleteHistoryDialogOpen, setDeleteHistoryDialogOpen] = useState(false);
  const [historyEntryToDelete, setHistoryEntryToDelete] = useState<PendingRegistration | null>(null);

  // Batch payment approval dialog state
  const [batchPaymentApprovalDialogOpen, setBatchPaymentApprovalDialogOpen] = useState(false);
  const [selectedPaymentGroup, setSelectedPaymentGroup] = useState<{ guardianEmail: string; guardianName: string; students: PendingPaymentStudent[] } | null>(null);
  const [batchPaymentApprovalReason, setBatchPaymentApprovalReason] = useState("");

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.full_name) {
          setUserFullName(profile.full_name);
        }
      }
    };
    fetchUserName();
  }, []);

  const getFullName = (reg: PendingRegistration) => {
    return [reg.first_name, reg.middle_name, reg.last_name].filter(Boolean).join(" ");
  };

  const getRegistrationType = (reg: PendingRegistration) => {
    if (reg.registration_type === "hifz") {
      return { label: "Hifz", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" };
    }
    if (reg.gender.toLowerCase() === "male") {
      return { label: "Maktab Boys", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" };
    }
    return { label: "Maktab Girls", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" };
  };

  const getLevelBadge = (reg: PendingRegistration) => {
    if (reg.registration_type === "hifz") return null;
    if (reg.assigned_group === "A") {
      return { label: "Qaidah", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" };
    }
    if (reg.assigned_group === "B") {
      return { label: "Quran", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" };
    }
    return null;
  };

  const getDestination = (reg: PendingRegistration) => {
    if (reg.registration_type === "hifz") {
      return "Boys Maktab (Group C)";
    }
    return reg.gender.toLowerCase() === "male" ? "Boys Maktab" : "Girls Maktab";
  };

  const getStatusBadge = (status: string) => {
    if (status === "approved") {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Approved</Badge>;
    }
    if (status === "rejected") {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Rejected</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  // Single registration approval
  const handleApproveClick = (registration: PendingRegistration) => {
    setSelectedRegistration(registration);
    if (registration.registration_type === "hifz") {
      setSelectedGroup("C");
    } else if (registration.assigned_group) {
      // Pre-select based on level: A = Qaidah, B = Quran
      setSelectedGroup(registration.assigned_group);
    } else {
      setSelectedGroup(null);
    }
    setApproveDialogOpen(true);
  };

  // Batch approval for grouped registrations
  const handleBatchApproveClick = (group: GroupedRegistrations) => {
    setSelectedGroup_batch(group);
    // Initialize group assignments - auto-assign C for Hifz, or use pre-selected level
    const initialAssignments: Record<string, string> = {};
    group.registrations.forEach(reg => {
      if (reg.registration_type === "hifz") {
        initialAssignments[reg.id] = "C";
      } else if (reg.assigned_group) {
        // Pre-select based on level: A = Qaidah, B = Quran
        initialAssignments[reg.id] = reg.assigned_group;
      }
    });
    setGroupAssignments(initialAssignments);
    setBatchApproveDialogOpen(true);
  };

  const handleRejectClick = (registration: PendingRegistration) => {
    setSelectedRegistration(registration);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleApproveConfirm = () => {
    if (!selectedRegistration) return;
    
    const maktab = selectedRegistration.gender.toLowerCase() === "male" ? "boys" : "girls";
    
    approveRegistration.mutate({
      registration: selectedRegistration,
      reviewerName: userFullName,
      maktab,
      studentGroup: selectedGroup,
    });
    
    setApproveDialogOpen(false);
    setSelectedRegistration(null);
    setSelectedGroup(null);
  };

  const handleBatchApproveConfirm = () => {
    if (!selectedGroup_batch) return;
    
    batchApproveRegistrations.mutate({
      registrations: selectedGroup_batch.registrations,
      reviewerName: userFullName,
      groupAssignments,
    });
    
    setBatchApproveDialogOpen(false);
    setSelectedGroup_batch(null);
    setGroupAssignments({});
  };

  const handleRejectConfirm = () => {
    if (!selectedRegistration || !rejectReason.trim()) return;
    
    rejectRegistration.mutate({
      registrationId: selectedRegistration.id,
      reviewerName: userFullName,
      reason: rejectReason,
      guardianEmail: selectedRegistration.guardian_email,
      guardianName: selectedRegistration.guardian_name,
      studentName: getFullName(selectedRegistration),
    });
    
    setRejectDialogOpen(false);
    setSelectedRegistration(null);
    setRejectReason("");
  };

  // Check if all non-Hifz registrations have group assignments
  const allGroupsAssigned = selectedGroup_batch?.registrations.every(reg => 
    reg.registration_type === "hifz" || groupAssignments[reg.id]
  ) ?? false;

  // Pending payment student handlers
  const handlePaymentApproveClick = (student: PendingPaymentStudent) => {
    setSelectedPaymentStudent(student);
    setPaymentApprovalReason("");
    setPaymentApprovalDialogOpen(true);
  };

  const handlePaymentApprovalConfirm = () => {
    if (!selectedPaymentStudent || !paymentApprovalReason.trim()) return;
    
    manualApprove.mutate({
      studentId: selectedPaymentStudent.id,
      approverName: userFullName,
      approvalReason: paymentApprovalReason.trim(),
    });
    
    setPaymentApprovalDialogOpen(false);
    setSelectedPaymentStudent(null);
    setPaymentApprovalReason("");
  };

  const handleResendPaymentLink = (student: PendingPaymentStudent) => {
    resendPaymentLink.mutate({ student });
  };

  const handleCancelPaymentClick = (student: PendingPaymentStudent) => {
    setStudentToCancel(student);
    setCancelReason("");
    setCancelPaymentDialogOpen(true);
  };

  const handleCancelPaymentConfirm = () => {
    if (!studentToCancel || !cancelReason.trim()) return;
    
    cancelRegistration.mutate({
      studentId: studentToCancel.id,
      studentName: studentToCancel.name,
      maktab: studentToCancel.maktab,
      cancellerName: userFullName,
      cancelReason: cancelReason.trim(),
    });
    
    setCancelPaymentDialogOpen(false);
    setStudentToCancel(null);
    setCancelReason("");
  };

  // Delete history entry handlers
  const handleDeleteHistoryClick = (registration: PendingRegistration) => {
    setHistoryEntryToDelete(registration);
    setDeleteHistoryDialogOpen(true);
  };

  const handleDeleteHistoryConfirm = () => {
    if (!historyEntryToDelete) return;
    
    deleteHistoryEntry.mutate({
      registrationId: historyEntryToDelete.id,
    });
    
    setDeleteHistoryDialogOpen(false);
    setHistoryEntryToDelete(null);
  };

  // Batch payment approval handlers
  const handleBatchPaymentApproveClick = (group: { guardianEmail: string; guardianName: string; students: PendingPaymentStudent[] }) => {
    setSelectedPaymentGroup(group);
    setBatchPaymentApprovalReason("");
    setBatchPaymentApprovalDialogOpen(true);
  };

  const handleBatchPaymentApprovalConfirm = () => {
    if (!selectedPaymentGroup || !batchPaymentApprovalReason.trim()) return;
    
    batchManualApprove.mutate({
      students: selectedPaymentGroup.students,
      approverName: userFullName,
      approvalReason: batchPaymentApprovalReason.trim(),
    });
    
    setBatchPaymentApprovalDialogOpen(false);
    setSelectedPaymentGroup(null);
    setBatchPaymentApprovalReason("");
  };

  const getMaktabBadge = (maktab: string) => {
    if (maktab === "boys") {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Maktab Boys</Badge>;
    }
    return <Badge className="bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200">Maktab Girls</Badge>;
  };

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return differenceInYears(new Date(), new Date(dob));
  };

  // Render a pending payment student card
  const renderPaymentStudentCard = (student: PendingPaymentStudent, isInGroup: boolean = false) => {
    return (
      <Card key={student.id} className={`overflow-hidden ${isInGroup ? 'border-l-4 border-l-primary/50' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{student.name}</CardTitle>
              {getMaktabBadge(student.maktab)}
              {student.student_group && (
                <Badge variant="outline">
                  {getGroupLabel(student.student_group)}
                </Badge>
              )}
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                <CreditCard className="h-3 w-3 mr-1" />
                Pending Payment
              </Badge>
            </div>
            {!isInGroup && (
              <Badge variant="outline" className="w-fit">
                → {student.maktab === "boys" ? "Boys Maktab" : "Girls Maktab"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Student Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4 shrink-0" />
              <span>Gender: {student.gender}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {student.date_of_birth 
                  ? `Age: ${getAge(student.date_of_birth)} years`
                  : "No age provided"
                }
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <span>
                {student.mobile_contact}{" "}
                <span className="text-xs">
                  ({student.gender?.toLowerCase() === "female" ? "Mother" : "Father"})
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{student.guardian_email}</span>
            </div>
            {student.address && (
              <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{student.address}, {student.post_code}</span>
              </div>
            )}
          </div>

          {/* Medical Notes */}
          {student.medical_notes && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="text-sm text-red-700 dark:text-red-300">
                <strong>Medical Notes:</strong> {student.medical_notes}
              </div>
            </div>
          )}

          {/* Guardian Info */}
          <div className="pt-2 border-t text-sm text-muted-foreground">
            <p>
              <strong>{student.gender?.toLowerCase() === "female" ? "Mother" : "Father"}:</strong> {student.guardian_name}
            </p>
            <p className="mt-2 text-xs">
              Registered {format(new Date(student.created_at), "dd MMM yyyy 'at' HH:mm")}
            </p>
          </div>

          {/* Action Buttons */}
          {!isInGroup && (
            <div className="flex gap-3 pt-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResendPaymentLink(student)}
                disabled={resendPaymentLink.isPending}
              >
                <RotateCw className="h-4 w-4 mr-1" />
                Resend Link
              </Button>
              <Button
                size="sm"
                onClick={() => handlePaymentApproveClick(student)}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleCancelPaymentClick(student)}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          )}

          {/* Actions for grouped view */}
          {isInGroup && (
            <div className="flex justify-end pt-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResendPaymentLink(student)}
                disabled={resendPaymentLink.isPending}
              >
                <RotateCw className="h-4 w-4 mr-1" />
                Resend
              </Button>
              <Button
                size="sm"
                onClick={() => handlePaymentApproveClick(student)}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleCancelPaymentClick(student)}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render grouped pending payment students
  const renderGroupedPaymentStudents = (group: { guardianEmail: string; guardianName: string; students: PendingPaymentStudent[] }) => {
    if (group.students.length === 1) {
      return renderPaymentStudentCard(group.students[0], false);
    }

    return (
      <Card key={group.guardianEmail} className="overflow-hidden border-2 border-primary/20">
        <CardHeader className="pb-3 bg-primary/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">{group.guardianName}</CardTitle>
                <p className="text-sm text-muted-foreground">{group.guardianEmail}</p>
              </div>
              <Badge variant="secondary" className="ml-2">
                {group.students.length} children
              </Badge>
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                <CreditCard className="h-3 w-3 mr-1" />
                Pending Payment
              </Badge>
            </div>
            <Button
              size="sm"
              onClick={() => handleBatchPaymentApproveClick(group)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Check className="h-4 w-4 mr-1" />
              Group Approve ({group.students.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {group.students.map((student) => renderPaymentStudentCard(student, true))}
        </CardContent>
      </Card>
    );
  };

  const renderRegistrationCard = (registration: PendingRegistration, showActions: boolean, isInGroup: boolean = false) => {
    const regType = getRegistrationType(registration);
    const levelBadge = getLevelBadge(registration);
    return (
      <Card key={registration.id} className={`overflow-hidden ${isInGroup ? 'border-l-4 border-l-primary/50' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{getFullName(registration)}</CardTitle>
              <Badge className={regType.color}>
                {regType.label}
              </Badge>
              {levelBadge && (
                <Badge className={levelBadge.color}>
                  {levelBadge.label}
                </Badge>
              )}
              {!showActions && getStatusBadge(registration.status)}
            </div>
            {showActions && (
              <Badge variant="outline" className="w-fit">
                → {getDestination(registration)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Student Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4 shrink-0" />
              <span>Gender: {registration.gender}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {registration.date_of_birth 
                  ? `Age: ${calculateAge(registration.date_of_birth)} years`
                  : registration.place_of_birth || "No age provided"
                }
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <span>
                {registration.gender.toLowerCase() === "female" && registration.mother_mobile
                  ? `${registration.mother_mobile} (Mother)`
                  : registration.mobile_contact}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{registration.guardian_email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{registration.address}, {registration.post_code}</span>
            </div>
          </div>

          {/* Medical Notes */}
          {registration.medical_notes && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="text-sm text-red-700 dark:text-red-300">
                <strong>Medical Notes:</strong> {registration.medical_notes}
              </div>
            </div>
          )}

          {/* Guardian Info */}
          <div className="pt-2 border-t text-sm text-muted-foreground">
            <p>
              {registration.gender.toLowerCase() === "female" && registration.mother_name ? (
                <>
                  <strong>Mother:</strong> {registration.mother_name}
                  {registration.guardian_name && registration.mother_name !== registration.guardian_name && (
                    <span className="ml-2 text-xs">• Father/Guardian: {registration.guardian_name}</span>
                  )}
                </>
              ) : (
                <><strong>Guardian:</strong> {registration.guardian_name}</>
              )}
            </p>
            {registration.ethnic_origin && (
              <p className="mt-1">
                <strong>Notes:</strong> {registration.ethnic_origin}
              </p>
            )}
            <p className="mt-2 text-xs">
              Submitted {format(new Date(registration.created_at), "dd MMM yyyy 'at' HH:mm")}
            </p>
            {!showActions && registration.reviewed_at && (
              <p className="mt-1 text-xs">
                {registration.status === "approved" ? "Approved" : "Rejected"} by {registration.reviewed_by_name || "Unknown"} on {format(new Date(registration.reviewed_at), "dd MMM yyyy 'at' HH:mm")}
                {registration.status === "approved" && registration.assigned_group && (
                  <span className="ml-1">• Assigned to {getGroupLabel(registration.assigned_group)}</span>
                )}
              </p>
            )}
            {!showActions && registration.status === "rejected" && registration.rejection_reason && (
              <p className="mt-2 text-xs text-destructive">
                <strong>Reason:</strong> {registration.rejection_reason}
              </p>
            )}
          </div>

          {/* Action Buttons - only show for single registrations not in a group */}
          {showActions && !isInGroup && (
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1"
                onClick={() => handleApproveClick(registration)}
                disabled={approveRegistration.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleRejectClick(registration)}
                disabled={rejectRegistration.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          )}

          {/* Individual reject button for grouped registrations */}
          {showActions && isInGroup && (
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleRejectClick(registration)}
                disabled={rejectRegistration.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          )}

          {/* Delete button for history entries */}
          {!showActions && (
            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDeleteHistoryClick(registration)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderGroupedRegistrations = (group: GroupedRegistrations) => {
    if (group.registrations.length === 1) {
      // Single registration - render normally
      return renderRegistrationCard(group.registrations[0], true, false);
    }

    // Multiple registrations from same guardian
    return (
      <Card key={group.guardianEmail} className="overflow-hidden border-2 border-primary/20">
        <CardHeader className="pb-3 bg-primary/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">{group.guardianName}</CardTitle>
                <p className="text-sm text-muted-foreground">{group.guardianEmail}</p>
              </div>
              <Badge variant="secondary" className="ml-2">
                {group.registrations.length} children
              </Badge>
            </div>
            <Button
              onClick={() => handleBatchApproveClick(group)}
              disabled={batchApproveRegistrations.isPending}
              className="w-full sm:w-auto"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve All ({group.registrations.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {group.registrations.map((registration) => (
            renderRegistrationCard(registration, true, true)
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 safe-top safe-bottom">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={paths.admin()}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Registrations</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Review and manage student registrations
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Review
              {(pendingRegistrations.length + pendingPaymentStudents.length) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {pendingRegistrations.length + pendingPaymentStudents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Pending Tab */}
          <TabsContent value="pending" className="mt-6">
            {/* Loading State */}
            {(isLoading || isLoadingPayment) && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !isLoadingPayment && pendingRegistrations.length === 0 && pendingPaymentStudents.length === 0 && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <UserPlus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Pending Registrations</h3>
                    <p className="text-muted-foreground">
                      All registrations have been reviewed. New submissions will appear here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Combined Registrations List */}
            {!isLoading && !isLoadingPayment && (groupedRegistrations.length > 0 || groupedPaymentStudents.length > 0) && (
              <div className="space-y-4">
                {/* Pending Payment Students */}
                {groupedPaymentStudents.map((group) => renderGroupedPaymentStudents(group))}
                
                {/* Pending Review Registrations */}
                {groupedRegistrations.map((group) => renderGroupedRegistrations(group))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-6">
            {/* Loading State */}
            {isLoadingHistory && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty State */}
            {!isLoadingHistory && registrationHistory.length === 0 && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <History className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Registration History</h3>
                    <p className="text-muted-foreground">
                      Approved and rejected registrations will appear here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* History List */}
            {!isLoadingHistory && registrationHistory.length > 0 && (
              <div className="space-y-4">
                <Badge variant="secondary" className="text-sm">
                  {registrationHistory.length} past registration{registrationHistory.length !== 1 ? "s" : ""}
                </Badge>
                {registrationHistory.map((registration) => renderRegistrationCard(registration, false))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Single Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Registration</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to approve the registration for{" "}
                  <strong>{selectedRegistration && getFullName(selectedRegistration)}</strong>?
                </p>
                {selectedRegistration && (
                  <div className="p-3 rounded-lg bg-muted text-sm">
                    <p>The student will be added to:</p>
                    <p className="font-medium mt-1">{getDestination(selectedRegistration)}</p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Group selection for non-Hifz registrations */}
          {selectedRegistration && 
           selectedRegistration.registration_type !== "hifz" && (
            <div className="py-4 space-y-3">
              <Label className="text-sm font-medium">Assign to Group</Label>
              <RadioGroup
                value={selectedGroup || ""}
                onValueChange={(value) => setSelectedGroup(value)}
                className="grid grid-cols-3 gap-3"
              >
                {getGroupCodesForMaktab(selectedRegistration.gender.toLowerCase() === "male" ? "boys" : "girls").map((code) => (
                  <div key={code} className="flex items-center space-x-2">
                    <RadioGroupItem value={code} id={`group-${code}`} />
                    <Label htmlFor={`group-${code}`} className="cursor-pointer text-sm">
                      {getGroupLabel(code)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleApproveConfirm}
              disabled={
                approveRegistration.isPending || 
                (selectedRegistration?.registration_type !== "hifz" && !selectedGroup)
              }
            >
              {approveRegistration.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Approve Confirmation Dialog */}
      <AlertDialog open={batchApproveDialogOpen} onOpenChange={setBatchApproveDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve All Registrations</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to approve {selectedGroup_batch?.registrations.length} registrations for{" "}
                  <strong>{selectedGroup_batch?.guardianName}</strong>.
                </p>
                <p className="text-sm text-muted-foreground">
                  Only one confirmation email will be sent to {selectedGroup_batch?.guardianEmail}.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Group selection for each student */}
          <div className="py-4 space-y-4">
            {selectedGroup_batch?.registrations.map((reg) => {
              const regType = getRegistrationType(reg);
              const isHifz = reg.registration_type === "hifz";
              
              return (
                <div key={reg.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getFullName(reg)}</span>
                    <Badge className={regType.color} variant="secondary">
                      {regType.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">→ {getDestination(reg)}</span>
                  </div>
                  
                  {!isHifz && (
                    <div className="space-y-2">
                      <Label className="text-sm">Assign to Group</Label>
                      <RadioGroup
                        value={groupAssignments[reg.id] || ""}
                        onValueChange={(value) => setGroupAssignments(prev => ({
                          ...prev,
                          [reg.id]: value
                        }))}
                        className="grid grid-cols-3 gap-2"
                      >
                        {getGroupCodesForMaktab(reg.gender.toLowerCase() === "male" ? "boys" : "girls").map((code) => (
                          <div key={code} className="flex items-center space-x-2">
                            <RadioGroupItem value={code} id={`batch-group-${reg.id}-${code}`} />
                            <Label htmlFor={`batch-group-${reg.id}-${code}`} className="cursor-pointer text-sm">
                              {getGroupLabel(code)}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  )}
                  
                  {isHifz && (
                    <p className="text-sm text-muted-foreground">Auto-assigned to Group C (Hifz)</p>
                  )}
                </div>
              );
            })}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBatchApproveConfirm}
              disabled={batchApproveRegistrations.isPending || !allGroupsAssigned}
            >
              {batchApproveRegistrations.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Approve All ({selectedGroup_batch?.registrations.length})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Registration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject the registration for{" "}
              <strong>{selectedRegistration && getFullName(selectedRegistration)}</strong>?
              An email will be sent to the guardian with the reason provided.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="reject-reason" className="text-sm font-medium">
              Reason for rejection <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-reason"
              placeholder="Please provide a reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className={!rejectReason.trim() ? "border-destructive/50" : ""}
            />
            {!rejectReason.trim() && (
              <p className="text-xs text-destructive">A reason is required to reject the registration</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRejectConfirm}
              disabled={rejectRegistration.isPending || !rejectReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectRegistration.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Reject & Send Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Approval Dialog */}
      <AlertDialog open={paymentApprovalDialogOpen} onOpenChange={setPaymentApprovalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Manual Approval - Payment Pending
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to manually approve <strong>{selectedPaymentStudent?.name}</strong> without
                  receiving payment. This will mark them as an active student.
                </p>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Warning:</strong> Payment is still pending for this student. Please
                    provide a reason for bypassing the payment requirement.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-approval-reason">Reason for manual approval *</Label>
                  <Textarea
                    id="payment-approval-reason"
                    placeholder="e.g., Payment received via cash, scholarship granted, fee waived..."
                    value={paymentApprovalReason}
                    onChange={(e) => setPaymentApprovalReason(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePaymentApprovalConfirm}
              disabled={!paymentApprovalReason.trim() || manualApprove.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {manualApprove.isPending ? "Approving..." : "Approve Without Payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Payment Registration Dialog */}
      <AlertDialog open={cancelPaymentDialogOpen} onOpenChange={setCancelPaymentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel Registration
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to cancel the registration for{" "}
                  <strong>{studentToCancel?.name}</strong>? This will permanently delete their student
                  record.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cancel-reason">Reason for cancellation *</Label>
                  <Textarea
                    id="cancel-reason"
                    placeholder="e.g., Guardian requested cancellation, duplicate registration, payment never received..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Registration</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelPaymentConfirm}
              disabled={!cancelReason.trim() || cancelRegistration.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelRegistration.isPending ? "Cancelling..." : "Cancel Registration"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Payment Approval Dialog */}
      <AlertDialog open={batchPaymentApprovalDialogOpen} onOpenChange={setBatchPaymentApprovalDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Group Approval - Payment Pending
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to manually approve <strong>{selectedPaymentGroup?.students.length} students</strong> for{" "}
                  <strong>{selectedPaymentGroup?.guardianName}</strong> without receiving payment.
                </p>
                <div className="p-3 rounded-lg bg-muted/50 max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium mb-2">Students to approve:</p>
                  <ul className="text-sm space-y-1">
                    {selectedPaymentGroup?.students.map((student) => (
                      <li key={student.id} className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-primary" />
                        {student.name} ({student.maktab === "boys" ? "Boys" : "Girls"})
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Warning:</strong> Payment is still pending for these students. Please
                    provide a reason for bypassing the payment requirement.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch-payment-approval-reason">Reason for manual approval *</Label>
                  <Textarea
                    id="batch-payment-approval-reason"
                    placeholder="e.g., Payment received via cash, scholarship granted, fee waived..."
                    value={batchPaymentApprovalReason}
                    onChange={(e) => setBatchPaymentApprovalReason(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchPaymentApprovalConfirm}
              disabled={!batchPaymentApprovalReason.trim() || batchManualApprove.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {batchManualApprove.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Approve All ({selectedPaymentGroup?.students.length})
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete History Entry Confirmation Dialog */}
      <AlertDialog open={deleteHistoryDialogOpen} onOpenChange={setDeleteHistoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Remove History Entry
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the registration history entry for{" "}
              <strong>
                {historyEntryToDelete && [
                  historyEntryToDelete.first_name,
                  historyEntryToDelete.middle_name,
                  historyEntryToDelete.last_name
                ].filter(Boolean).join(" ")}
              </strong>?
              <br /><br />
              This will permanently delete this record from the registration history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHistoryConfirm}
              disabled={deleteHistoryEntry.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteHistoryEntry.isPending ? "Removing..." : "Remove Entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Registrations;
