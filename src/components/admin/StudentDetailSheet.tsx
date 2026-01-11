import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useStudentDetails, StudentDetails } from "@/hooks/useStudentDetails";
import { useDeleteStudent } from "@/hooks/useDeleteStudent";
import { Edit, Save, X, User, MapPin, Users, GraduationCap, FileText, CreditCard, Trash2, Mail, ArrowRightLeft, Send, Loader2 } from "lucide-react";
import { SendPortalInviteButton } from "@/components/admin/SendPortalInviteButton";
import { format, differenceInYears, parseISO } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StudentDetailSheetProps {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const calculateAge = (dateOfBirth: string | null): string => {
  if (!dateOfBirth) return "-";
  try {
    const dob = parseISO(dateOfBirth);
    const age = differenceInYears(new Date(), dob);
    return `${age} years`;
  } catch {
    return "-";
  }
};

const formatDate = (date: string | null): string => {
  if (!date) return "-";
  try {
    return format(parseISO(date), "dd/MM/yyyy");
  } catch {
    return date;
  }
};

export const StudentDetailSheet = ({ studentId, open, onOpenChange }: StudentDetailSheetProps) => {
  const { student, isLoading, updateStudent, isUpdating, transferMaktab, isTransferring } = useStudentDetails(studentId);
  const { deleteStudent, isDeleting } = useDeleteStudent();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<StudentDetails>>({});
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [isSendingPaymentLink, setIsSendingPaymentLink] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (student) {
      setFormData(student);
    }
  }, [student]);

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);

  const handleSave = () => {
    updateStudent(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (student) {
      setFormData(student);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (student) {
      deleteStudent(
        { id: student.id, studentCode: student.student_code, maktab: student.maktab },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  const handleTransferMaktab = () => {
    if (student) {
      const newMaktab = student.maktab === "boys" ? "girls" : "boys";
      transferMaktab(newMaktab, {
        onSuccess: () => {
          setShowTransferDialog(false);
        }
      });
    }
  };

  const handleSendPaymentLink = async () => {
    if (!student || !student.guardian_email) {
      toast.error("Guardian email is required to send payment link");
      return;
    }
    
    setIsSendingPaymentLink(true);
    try {
      const { error } = await supabase.functions.invoke("send-payment-link", {
        body: {
          studentId: student.id,
          guardianEmail: student.guardian_email,
          studentName: student.name,
          maktab: student.maktab,
        },
      });

      if (error) throw error;
      toast.success("Payment link sent to guardian");
    } catch (err: any) {
      console.error("Error sending payment link:", err);
      toast.error(err.message || "Failed to send payment link");
    } finally {
      setIsSendingPaymentLink(false);
    }
  };

  const updateField = (field: keyof StudentDetails, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value || null }));
  };

  const renderField = (label: string, field: keyof StudentDetails, type: "text" | "date" | "textarea" = "text") => {
    const value = formData[field] as string | null;
    
    if (isEditing) {
      if (type === "textarea") {
        return (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Textarea
              value={value || ""}
              onChange={(e) => updateField(field, e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        );
      }
      return (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Input
            type={type}
            value={value || ""}
            onChange={(e) => updateField(field, e.target.value)}
            className="h-9"
          />
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">
          {type === "date" ? formatDate(value) : (value || "-")}
        </p>
      </div>
    );
  };

  const renderSelectField = (label: string, field: keyof StudentDetails, options: { value: string; label: string }[]) => {
    const value = formData[field] as string | null;
    
    if (isEditing) {
      return (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Select value={value || ""} onValueChange={(v) => updateField(field, v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    const selectedOption = options.find(opt => opt.value === value);
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{selectedOption?.label || "-"}</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "h-[90vh] rounded-t-xl" : "w-full sm:max-w-xl"}>
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!student) {
    return null;
  }

  const tabsContent = (
    <Tabs defaultValue="personal" className="mt-4">
      <TabsList className={`grid w-full ${isMobile ? "grid-cols-3 h-auto" : "grid-cols-6"}`}>
        <TabsTrigger value="personal" className="text-xs px-1 py-1.5">
          <User className="h-3 w-3 mr-1" />
          <span className={isMobile ? "" : "hidden sm:inline"}>Personal</span>
        </TabsTrigger>
        <TabsTrigger value="contact" className="text-xs px-1 py-1.5">
          <MapPin className="h-3 w-3 mr-1" />
          <span className={isMobile ? "" : "hidden sm:inline"}>Contact</span>
        </TabsTrigger>
        <TabsTrigger value="demographics" className="text-xs px-1 py-1.5">
          <Users className="h-3 w-3 mr-1" />
          <span className={isMobile ? "" : "hidden sm:inline"}>Demo</span>
        </TabsTrigger>
        {isMobile && (
          <>
            <TabsTrigger value="education" className="text-xs px-1 py-1.5">
              <GraduationCap className="h-3 w-3 mr-1" />
              Edu
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs px-1 py-1.5">
              <CreditCard className="h-3 w-3 mr-1" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="other" className="text-xs px-1 py-1.5">
              <FileText className="h-3 w-3 mr-1" />
              Other
            </TabsTrigger>
          </>
        )}
        {!isMobile && (
          <>
            <TabsTrigger value="education" className="text-xs px-1 py-1.5">
              <GraduationCap className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Edu</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs px-1 py-1.5">
              <CreditCard className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="other" className="text-xs px-1 py-1.5">
              <FileText className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Other</span>
            </TabsTrigger>
          </>
        )}
      </TabsList>

      <TabsContent value="personal" className="mt-4 space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {renderField("Full Name", "name")}
          {renderField("Student Code", "student_code")}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {renderField("Date of Birth", "date_of_birth", "date")}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Age</p>
            <p className="text-sm font-medium">{calculateAge(formData.date_of_birth ?? null)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {renderField("Year Group", "year_group")}
          {renderSelectField("Gender", "gender", [
            { value: "boys", label: "Male" },
            { value: "girls", label: "Female" },
          ])}
        </div>
        {renderSelectField("Status", "status", [
          { value: "active", label: "Active" },
          { value: "pending_payment", label: "Pending Payment" },
          { value: "left", label: "Left" },
        ])}
      </TabsContent>

      <TabsContent value="contact" className="mt-4 space-y-3 sm:space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {renderField("House Number", "house_number")}
          {renderField("Post Code", "post_code")}
        </div>
        {renderField("Address", "address")}
        <div className="border-t pt-3 sm:pt-4 mt-3 sm:mt-4">
          <h4 className="text-sm font-medium mb-3">Guardian Information</h4>
          {renderField("Name of Father/Guardian", "guardian_name")}
          {renderField("Email", "guardian_email")}
          
          {/* Portal Invite Button */}
          {!isEditing && formData.student_code && (
            <div className="mt-3">
              <SendPortalInviteButton
                studentCode={formData.student_code}
                studentName={formData.name || ""}
                guardianEmail={formData.guardian_email || null}
                lastInviteEmail={formData.portal_invite_email}
                lastInviteSentAt={formData.portal_invite_sent_at}
                size="sm"
                className="w-full sm:w-auto"
              />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
            {renderField("Home Contact No.", "home_contact")}
            {renderField("Mobile", "mobile_contact")}
          </div>
          {renderField("Extra Tel", "extra_tel")}
        </div>
      </TabsContent>

      <TabsContent value="demographics" className="mt-4 space-y-3 sm:space-y-4">
        {renderField("Ethnic Origin", "ethnic_origin")}
        {renderField("Language Other Than English", "other_language")}
      </TabsContent>

      <TabsContent value="education" className="mt-4 space-y-3 sm:space-y-4">
        {renderField("Student Group", "student_group")}
        {renderField("Reading Level", "reading_level")}
        <div className="border-t pt-3 sm:pt-4 mt-3 sm:mt-4">
          <h4 className="text-sm font-medium mb-3">Previous Madrasa</h4>
          {renderField("Last Madrasa", "last_madrasa")}
          {renderField("Madrasa Address", "last_madrasa_address")}
          {renderField("Reason for Leaving", "reason_for_leaving", "textarea")}
        </div>
      </TabsContent>

      <TabsContent value="billing" className="mt-4 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Stripe / Billing Information</h4>
          {formData.status === "pending_payment" && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              Awaiting Payment
            </Badge>
          )}
        </div>
        
        {/* Stripe Customer ID - with manual entry hint */}
        <div className="space-y-1.5">
          {isEditing ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Stripe Customer ID</Label>
              <Input
                type="text"
                value={formData.stripe_customer_id || ""}
                onChange={(e) => updateField("stripe_customer_id", e.target.value)}
                placeholder="cus_xxxxxxxxxxxxx"
                className="h-9 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter the Stripe customer ID from your Stripe dashboard (starts with cus_)
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Stripe Customer ID</p>
              <p className="text-sm font-medium font-mono">
                {formData.stripe_customer_id || <span className="text-muted-foreground italic font-sans">Not set - click Edit to add manually</span>}
              </p>
            </div>
          )}
        </div>
        
        {renderField("Billing Email", "billing_email")}
        
        {/* Payment Link Actions */}
        {!isEditing && (
          <div className="border-t pt-4 mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">Payment Actions</p>
            <Button 
              variant={formData.status === "pending_payment" ? "default" : "outline"} 
              size="sm" 
              className="w-full"
              onClick={handleSendPaymentLink}
              disabled={isSendingPaymentLink || !formData.guardian_email}
            >
              {isSendingPaymentLink ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {formData.status === "pending_payment" ? "Send Payment Link" : "Resend Payment Link"}
                </>
              )}
            </Button>
            {!formData.guardian_email && (
              <p className="text-xs text-muted-foreground text-center">
                Guardian email required to send payment link
              </p>
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="other" className="mt-4 space-y-3 sm:space-y-4">
        {renderField("Medical / Notes", "medical_notes", "textarea")}
        {renderField("Admission Date", "admission_date", "date")}
        <div className="border-t pt-3 sm:pt-4 mt-3 sm:mt-4">
          <h4 className="text-sm font-medium mb-3">System Information</h4>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Created At</p>
              <p className="text-sm font-medium">{formatDate(student.created_at)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Maktab</p>
              <p className="text-sm font-medium">{student.maktab === "boys" ? "Boys" : "Girls"}</p>
            </div>
          </div>
          
          {/* Transfer Maktab Button */}
          {!isEditing && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Transfer Student</p>
              <p className="text-xs text-muted-foreground mb-3">
                Move this student to the {student.maktab === "boys" ? "Girls" : "Boys"} Maktab. 
                A new student code will be assigned.
              </p>
              <AlertDialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Transfer to {student.maktab === "boys" ? "Girls" : "Boys"} Maktab
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Transfer Student</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>
                        Are you sure you want to transfer <strong>{student.name}</strong> from{" "}
                        <strong>{student.maktab === "boys" ? "Boys" : "Girls"} Maktab</strong> to{" "}
                        <strong>{student.maktab === "boys" ? "Girls" : "Boys"} Maktab</strong>?
                      </p>
                      <p className="text-amber-600 dark:text-amber-400">
                        ⚠️ A new student code will be assigned for the new maktab.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleTransferMaktab} 
                      className="w-full sm:w-auto"
                      disabled={isTransferring}
                    >
                      {isTransferring ? "Transferring..." : "Transfer Student"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side={isMobile ? "bottom" : "right"} 
        className={isMobile ? "h-[90vh] rounded-t-xl px-4" : "w-full sm:max-w-xl"}
      >
        {isMobile && <div className="w-10 h-1 bg-muted rounded-full mx-auto mt-2 mb-2" />}
        
        <SheetHeader className="space-y-1 pb-2">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-lg sm:text-xl truncate">{student.name}</SheetTitle>
            <div className="flex gap-1.5 flex-shrink-0">
              {isEditing ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleCancel} disabled={isUpdating} className="h-8 px-2">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isUpdating} className="h-8 px-2">
                    <Save className="h-4 w-4 mr-1" />
                    {isUpdating ? "..." : "Save"}
                  </Button>
                </>
              ) : (
                <>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive h-8 px-2" disabled={isDeleting}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-base">Delete Student</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                          Are you sure you want to delete <strong>{student.name}</strong>? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto">
                          {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8 px-2">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>
          <SheetDescription className="text-xs sm:text-sm">
            {student.student_code} • {student.maktab === "boys" ? "Boys" : "Girls"} Maktab
          </SheetDescription>
        </SheetHeader>

        {isMobile ? (
          <ScrollArea className="h-[calc(100%-6rem)] -mx-4 px-4">
            {tabsContent}
            <div className="h-4" /> {/* Bottom padding */}
          </ScrollArea>
        ) : (
          <div className="overflow-y-auto h-[calc(100%-5rem)]">
            {tabsContent}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};