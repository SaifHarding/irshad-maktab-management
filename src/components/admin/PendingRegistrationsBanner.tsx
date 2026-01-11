import { useState, useMemo } from "react";
import { UserPlus, ChevronDown, ChevronUp, Check, X, Calendar, Phone, Mail, MapPin, Loader2, Users, AlertCircle, CreditCard, RotateCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePendingRegistrations, type PendingRegistration } from "@/hooks/usePendingRegistrations";
import { usePendingPaymentStudents, type PendingPaymentStudent } from "@/hooks/usePendingPaymentStudents";
import { format, differenceInYears } from "date-fns";
import { getGroupLabel, getGroupCodesForMaktab } from "@/lib/groups";

const calculateAge = (dob: string) => {
  return differenceInYears(new Date(), new Date(dob));
};

interface PendingRegistrationsBannerProps {
  userFullName: string;
  maktab: "boys" | "girls";
}

interface GroupedRegistration {
  guardianEmail: string;
  guardianName: string;
  registrations: PendingRegistration[];
}

export function PendingRegistrationsBanner({ userFullName, maktab }: PendingRegistrationsBannerProps) {
  const { pendingRegistrations, approveRegistration, rejectRegistration, batchApproveRegistrations } = usePendingRegistrations();
  const { pendingPaymentStudents, resendPaymentLink, manualApprove, cancelRegistration } = usePendingPaymentStudents(maktab);
  const [isOpen, setIsOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [batchApproveDialogOpen, setBatchApproveDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<PendingRegistration | null>(null);
  const [selectedGroupedFamily, setSelectedGroupedFamily] = useState<GroupedRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedGroupCode, setSelectedGroupCode] = useState<string | null>(null);
  const [batchGroupSelections, setBatchGroupSelections] = useState<Record<string, string>>({});

  // Payment student dialog states
  const [paymentApproveDialogOpen, setPaymentApproveDialogOpen] = useState(false);
  const [paymentCancelDialogOpen, setPaymentCancelDialogOpen] = useState(false);
  const [selectedPaymentStudent, setSelectedPaymentStudent] = useState<PendingPaymentStudent | null>(null);
  const [paymentApprovalReason, setPaymentApprovalReason] = useState("");
  const [paymentCancelReason, setPaymentCancelReason] = useState("");

  // Filter registrations by maktab: boys shows male + hifz, girls shows female
  const filteredRegistrations = pendingRegistrations.filter((reg) => {
    const isMale = reg.gender.toLowerCase() === "male";
    if (maktab === "boys") {
      return isMale; // Boys maktab shows male registrations (including hifz)
    } else {
      return !isMale; // Girls maktab shows female registrations
    }
  });

  const filteredPaymentStudents = pendingPaymentStudents.filter((s) => s.maktab === maktab);

  // Group pending payment students by guardian email
  const groupedPaymentStudents = useMemo(() => {
    const grouped = new Map<string, { guardianEmail: string; guardianName: string; students: PendingPaymentStudent[] }>();

    filteredPaymentStudents.forEach((s) => {
      const email = (s.guardian_email || "").toLowerCase();
      const key = email || "unknown";

      if (!grouped.has(key)) {
        grouped.set(key, {
          guardianEmail: s.guardian_email || "Unknown",
          guardianName: s.guardian_name || "Unknown",
          students: [],
        });
      }

      grouped.get(key)!.students.push(s);
    });

    return Array.from(grouped.values());
  }, [filteredPaymentStudents]);

  // Group registrations by guardian email
  const groupedRegistrations = useMemo(() => {
    const grouped = new Map<string, GroupedRegistration>();
    
    filteredRegistrations.forEach((reg) => {
      const email = reg.guardian_email.toLowerCase();
      if (!grouped.has(email)) {
        // For girls maktab, use mother's name as primary display name
        const displayName = maktab === "girls" && reg.mother_name 
          ? reg.mother_name 
          : reg.guardian_name;
        grouped.set(email, {
          guardianEmail: reg.guardian_email,
          guardianName: displayName,
          registrations: [],
        });
      }
      grouped.get(email)!.registrations.push(reg);
    });
    
    return Array.from(grouped.values());
  }, [filteredRegistrations, maktab]);

  const registrationCount = filteredRegistrations.length;
  const paymentCount = filteredPaymentStudents.length;
  const totalCount = registrationCount + paymentCount;

  if (totalCount === 0) return null;

  const handleApproveClick = (registration: PendingRegistration) => {
    setSelectedRegistration(registration);
    // For Hifz, group is auto-assigned to C
    if (registration.registration_type === "hifz") {
      setSelectedGroupCode("C");
    } else if (registration.assigned_group) {
      // Pre-select based on level: A = Qaidah, B = Quran
      setSelectedGroupCode(registration.assigned_group);
    } else {
      // Both boys and girls need group selection
      setSelectedGroupCode(null);
    }
    setApproveDialogOpen(true);
  };

  const handleApproveConfirm = () => {
    if (!selectedRegistration) return;
    
    const regMaktab = selectedRegistration.gender.toLowerCase() === "male" ? "boys" : "girls";
    
    approveRegistration.mutate({
      registration: selectedRegistration,
      reviewerName: userFullName,
      maktab: regMaktab,
      studentGroup: selectedGroupCode,
    });
    
    setApproveDialogOpen(false);
    setSelectedRegistration(null);
    setSelectedGroupCode(null);
  };

  const handleRejectClick = (registration: PendingRegistration) => {
    setSelectedRegistration(registration);
    setRejectReason("");
    setRejectDialogOpen(true);
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

  const handleBatchApproveClick = (group: GroupedRegistration) => {
    setSelectedGroupedFamily(group);
    // Initialize group selections - auto-assign C for Hifz, or use pre-selected level
    const initialSelections: Record<string, string> = {};
    group.registrations.forEach((reg) => {
      if (reg.registration_type === "hifz") {
        initialSelections[reg.id] = "C";
      } else if (reg.assigned_group) {
        // Pre-select based on level: A = Qaidah, B = Quran
        initialSelections[reg.id] = reg.assigned_group;
      }
    });
    setBatchGroupSelections(initialSelections);
    setBatchApproveDialogOpen(true);
  };

  const handleBatchApproveConfirm = () => {
    if (!selectedGroupedFamily) return;
    
    batchApproveRegistrations.mutate({
      registrations: selectedGroupedFamily.registrations,
      reviewerName: userFullName,
      groupAssignments: batchGroupSelections,
    });
    
    setBatchApproveDialogOpen(false);
    setSelectedGroupedFamily(null);
    setBatchGroupSelections({});
  };

  // Payment student handlers
  const handlePaymentApproveClick = (student: PendingPaymentStudent) => {
    setSelectedPaymentStudent(student);
    setPaymentApprovalReason("");
    setPaymentApproveDialogOpen(true);
  };

  const handlePaymentApproveConfirm = () => {
    if (!selectedPaymentStudent || !paymentApprovalReason.trim()) return;
    
    manualApprove.mutate({
      studentId: selectedPaymentStudent.id,
      approverName: userFullName,
      approvalReason: paymentApprovalReason.trim(),
    });
    
    setPaymentApproveDialogOpen(false);
    setSelectedPaymentStudent(null);
    setPaymentApprovalReason("");
  };

  const handlePaymentCancelClick = (student: PendingPaymentStudent) => {
    setSelectedPaymentStudent(student);
    setPaymentCancelReason("");
    setPaymentCancelDialogOpen(true);
  };

  const handlePaymentCancelConfirm = () => {
    if (!selectedPaymentStudent || !paymentCancelReason.trim()) return;
    
    cancelRegistration.mutate({
      studentId: selectedPaymentStudent.id,
      studentName: selectedPaymentStudent.name,
      maktab: selectedPaymentStudent.maktab,
      cancellerName: userFullName,
      cancelReason: paymentCancelReason.trim(),
    });
    
    setPaymentCancelDialogOpen(false);
    setSelectedPaymentStudent(null);
    setPaymentCancelReason("");
  };

  const getFullName = (reg: PendingRegistration) => {
    return [reg.first_name, reg.middle_name, reg.last_name].filter(Boolean).join(" ");
  };

  const getDestination = (reg: PendingRegistration) => {
    if (reg.registration_type === "hifz") {
      return "Boys Maktab (Group C)";
    }
    return reg.gender.toLowerCase() === "male" ? "Boys Maktab" : "Girls Maktab";
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

  const needsGroupSelection = (reg: PendingRegistration | null) => {
    if (!reg) return false;
    // All non-Hifz registrations need group selection (both boys and girls)
    return reg.registration_type !== "hifz";
  };

  const allBatchGroupsSelected = () => {
    if (!selectedGroupedFamily) return false;
    return selectedGroupedFamily.registrations.every((reg) => {
      if (reg.registration_type === "hifz") return true;
      return batchGroupSelections[reg.id];
    });
  };

  const renderRegistrationCard = (registration: PendingRegistration, showActions: boolean = true) => {
    const levelBadge = getLevelBadge(registration);
    return (
      <div
        key={registration.id}
        className="p-4 rounded-lg border border-amber-200 bg-white dark:bg-background dark:border-amber-800"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-foreground">
                {getFullName(registration)}
              </h4>
              {registration.registration_type === "hifz" && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
                  Hifz
                </Badge>
              )}
              {levelBadge && (
                <Badge className={`${levelBadge.color} text-xs`}>
                  {levelBadge.label}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {registration.gender}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                → {getDestination(registration)}
              </Badge>
            </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>Age: {calculateAge(registration.date_of_birth)} years</span>
            </div>
            {maktab === "boys" && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                <span>{registration.mobile_contact}</span>
              </div>
            )}
            {maktab === "girls" && registration.mother_mobile && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                <span>{registration.mother_mobile}</span>
              </div>
            )}
            {maktab === "boys" && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{registration.guardian_email}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{registration.post_code}</span>
            </div>
          </div>
          
          {registration.medical_notes && (
            <div className="flex items-start gap-1.5 p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <span className="text-xs text-red-700 dark:text-red-300">
                <strong>Medical:</strong> {registration.medical_notes}
              </span>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            {maktab === "girls" && registration.mother_name
              ? `Mother: ${registration.mother_name}`
              : `Guardian: ${registration.guardian_name}`} • Submitted {format(new Date(registration.created_at), "dd MMM yyyy 'at' HH:mm")}
          </p>
        </div>
        
        {showActions && (
          <div className="flex gap-2 sm:flex-col">
            <Button
              size="sm"
              onClick={() => handleApproveClick(registration)}
              disabled={approveRegistration.isPending}
              className="flex-1 sm:flex-none"
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRejectClick(registration)}
              disabled={rejectRegistration.isPending}
              className="flex-1 sm:flex-none text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
  };

  const renderGroupedFamily = (group: GroupedRegistration) => {
    const isMultiple = group.registrations.length > 1;
    
    if (!isMultiple) {
      return renderRegistrationCard(group.registrations[0]);
    }
    
    return (
      <div
        key={group.guardianEmail}
        className="rounded-lg border-2 border-amber-300 dark:border-amber-700 overflow-hidden"
      >
        {/* Family Header */}
        <div className="bg-amber-100/50 dark:bg-amber-900/30 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {group.guardianName}
            </span>
            <Badge variant="secondary" className="text-xs">
              {group.registrations.length} children
            </Badge>
          </div>
          <Button
            size="sm"
            onClick={() => handleBatchApproveClick(group)}
            disabled={batchApproveRegistrations.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Check className="h-4 w-4 mr-1" />
            Approve All
          </Button>
        </div>
        
        {/* Nested Children */}
        <div className="p-3 space-y-3">
          {group.registrations.map((reg) => {
            const levelBadge = getLevelBadge(reg);
            return (
            <div
              key={reg.id}
              className="p-3 rounded-lg border border-amber-200 bg-white dark:bg-background dark:border-amber-800"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-foreground text-sm">
                      {getFullName(reg)}
                    </h4>
                    {reg.registration_type === "hifz" && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
                        Hifz
                      </Badge>
                    )}
                    {levelBadge && (
                      <Badge className={`${levelBadge.color} text-xs`}>
                        {levelBadge.label}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {reg.gender}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      → {getDestination(reg)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Age: {calculateAge(reg.date_of_birth)} years
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {reg.post_code}
                    </span>
                    <span>
                      Submitted {format(new Date(reg.created_at), "dd MMM yyyy")}
                    </span>
                  </div>
                  
                  {reg.medical_notes && (
                    <div className="flex items-start gap-1.5 p-1.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 mt-1">
                      <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                      <span className="text-xs text-red-700 dark:text-red-300">
                        <strong>Medical:</strong> {reg.medical_notes}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApproveClick(reg)}
                    disabled={approveRegistration.isPending}
                    className="text-xs h-7"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRejectClick(reg)}
                    disabled={rejectRegistration.isPending}
                    className="text-xs h-7 text-destructive hover:text-destructive"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          );
          })}
        </div>
        
        {/* Family Footer */}
        <div className="bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
          {maktab === "boys" && (
            <>
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {group.guardianEmail}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {group.registrations[0].mobile_contact}
              </span>
            </>
          )}
          {maktab === "girls" && group.registrations[0].mother_mobile && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {group.registrations[0].mother_mobile}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 mb-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
                    <UserPlus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-medium text-amber-800 dark:text-amber-200">
                      Pending Items
                    </CardTitle>
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      {registrationCount} awaiting approval • {paymentCount} awaiting payment
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                    {totalCount}
                  </Badge>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-amber-600" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-amber-600" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                {groupedPaymentStudents.length > 0 && (
                  <div className="space-y-2">
                    {groupedPaymentStudents.map((group) => (
                      <div key={`pay-${group.guardianEmail}`} className="p-3 rounded-lg border border-primary/20 bg-background">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-foreground truncate">{group.guardianName}</div>
                            <div className="text-xs text-muted-foreground truncate">{group.guardianEmail}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{group.students.length} child{group.students.length !== 1 ? "ren" : ""}</Badge>
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
                              <CreditCard className="h-3 w-3 mr-1" />
                              Pending Payment
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-2 space-y-2">
                          {group.students.map((s) => (
                            <div key={s.id} className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="text-sm text-foreground">{s.name}</div>
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => resendPaymentLink.mutate({ student: s })}
                                  disabled={resendPaymentLink.isPending}
                                  className="h-7 text-xs"
                                >
                                  <RotateCw className="h-3 w-3 mr-1" />
                                  Resend
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handlePaymentApproveClick(s)}
                                  className="h-7 text-xs"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePaymentCancelClick(s)}
                                  className="h-7 text-xs text-destructive hover:text-destructive"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {groupedRegistrations.map((group) => renderGroupedFamily(group))}
              </CardContent>
            </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Approve Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Registration</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve the registration for{" "}
              <strong>{selectedRegistration && getFullName(selectedRegistration)}</strong>?
            </DialogDescription>
          </DialogHeader>
          
          {selectedRegistration && (
            <div className="p-3 rounded-lg bg-muted text-sm">
              <p>The student will be added to:</p>
              <p className="font-medium mt-1">{getDestination(selectedRegistration)}</p>
            </div>
          )}

          {/* Group selection for non-Hifz */}
          {needsGroupSelection(selectedRegistration) && (
            <div className="py-2 space-y-3">
              <Label className="text-sm font-medium">Assign to Group</Label>
              <RadioGroup
                value={selectedGroupCode || ""}
                onValueChange={(value) => setSelectedGroupCode(value)}
                className="grid grid-cols-1 gap-2"
              >
                {getGroupCodesForMaktab(selectedRegistration?.gender?.toLowerCase() === "male" ? "boys" : "girls").map((code) => (
                  <div key={code} className="flex items-center space-x-2">
                    <RadioGroupItem value={code} id={`banner-group-${code}`} />
                    <Label htmlFor={`banner-group-${code}`} className="cursor-pointer text-sm">
                      {getGroupLabel(code)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApproveConfirm}
              disabled={
                approveRegistration.isPending || 
                (needsGroupSelection(selectedRegistration) && !selectedGroupCode)
              }
            >
              {approveRegistration.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Approve Confirmation Dialog */}
      <Dialog open={batchApproveDialogOpen} onOpenChange={setBatchApproveDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve All Registrations</DialogTitle>
            <DialogDescription>
              You are about to approve {selectedGroupedFamily?.registrations.length} registrations for the same guardian. 
              Only one confirmation email will be sent.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {selectedGroupedFamily?.registrations.map((reg) => (
              <div key={reg.id} className="p-3 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{getFullName(reg)}</span>
                    {reg.registration_type === "hifz" && (
                      <Badge className="bg-emerald-100 text-emerald-800 text-xs">Hifz</Badge>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    → {getDestination(reg)}
                  </Badge>
                </div>
                
                {reg.registration_type !== "hifz" && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Assign to Group</Label>
                    <RadioGroup
                      value={batchGroupSelections[reg.id] || ""}
                      onValueChange={(value) => setBatchGroupSelections((prev) => ({
                        ...prev,
                        [reg.id]: value,
                      }))}
                      className="flex gap-4"
                    >
                      {getGroupCodesForMaktab(reg.gender?.toLowerCase() === "male" ? "boys" : "girls").map((code) => (
                        <div key={code} className="flex items-center space-x-2">
                          <RadioGroupItem value={code} id={`batch-${reg.id}-${code}`} className="h-3 w-3" />
                          <Label htmlFor={`batch-${reg.id}-${code}`} className="cursor-pointer text-xs">
                            {getGroupLabel(code)}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBatchApproveConfirm}
              disabled={batchApproveRegistrations.isPending || !allBatchGroupsSelected()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {batchApproveRegistrations.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Approve All ({selectedGroupedFamily?.registrations.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Registration</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject the registration for{" "}
              <strong>{selectedRegistration && getFullName(selectedRegistration)}</strong>?
              An email will be sent to the guardian with the reason provided.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="reject-reason-banner" className="text-sm font-medium">
              Reason for rejection <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-reason-banner"
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectConfirm}
              disabled={rejectRegistration.isPending || !rejectReason.trim()}
            >
              Reject & Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Manual Approval Dialog */}
      <Dialog open={paymentApproveDialogOpen} onOpenChange={setPaymentApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Manual Approval - Payment Pending
            </DialogTitle>
            <DialogDescription>
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
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="payment-approval-reason-banner">Reason for manual approval *</Label>
            <Textarea
              id="payment-approval-reason-banner"
              placeholder="e.g., Payment received via cash, scholarship granted, fee waived..."
              value={paymentApprovalReason}
              onChange={(e) => setPaymentApprovalReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePaymentApproveConfirm}
              disabled={!paymentApprovalReason.trim() || manualApprove.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {manualApprove.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Approve Without Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Cancel Registration Dialog */}
      <Dialog open={paymentCancelDialogOpen} onOpenChange={setPaymentCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel Registration
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the registration for{" "}
              <strong>{selectedPaymentStudent?.name}</strong>? This will permanently delete their student
              record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="payment-cancel-reason-banner">Reason for cancellation *</Label>
            <Textarea
              id="payment-cancel-reason-banner"
              placeholder="e.g., Guardian requested cancellation, duplicate registration, payment never received..."
              value={paymentCancelReason}
              onChange={(e) => setPaymentCancelReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentCancelDialogOpen(false)}>
              Keep Registration
            </Button>
            <Button
              variant="destructive"
              onClick={handlePaymentCancelConfirm}
              disabled={!paymentCancelReason.trim() || cancelRegistration.isPending}
            >
              {cancelRegistration.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Cancel Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
