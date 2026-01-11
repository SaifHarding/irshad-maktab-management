import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface AddStudentDialogProps {
  defaultMaktab?: "boys" | "girls";
}

const AddStudentDialog = ({ defaultMaktab }: AddStudentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [formData, setFormData] = useState({
    name: "",
    maktab: defaultMaktab || "boys",
    student_group: "",
    gender: "",
    status: "active",
    date_of_birth: "",
    year_group: "",
    house_number: "",
    address: "",
    post_code: "",
    ethnic_origin: "",
    other_language: "",
    guardian_name: "",
    guardian_email: "",
    home_contact: "",
    mobile_contact: "",
    extra_tel: "",
    last_madrasa: "",
    last_madrasa_address: "",
    reason_for_leaving: "",
    reading_level: "",
    medical_notes: "",
    admission_date: "",
    stripe_customer_id: "",
    billing_email: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      maktab: defaultMaktab || "boys",
      student_group: "",
      gender: "",
      status: "active",
      date_of_birth: "",
      year_group: "",
      house_number: "",
      address: "",
      post_code: "",
      ethnic_origin: "",
      other_language: "",
      guardian_name: "",
      guardian_email: "",
      home_contact: "",
      mobile_contact: "",
      extra_tel: "",
      last_madrasa: "",
      last_madrasa_address: "",
      reason_for_leaving: "",
      reading_level: "",
      medical_notes: "",
      admission_date: "",
      stripe_customer_id: "",
      billing_email: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Student name is required",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      const insertData = {
        name: formData.name.trim(),
        maktab: formData.maktab,
        status: formData.status,
        student_group: formData.student_group || null,
        gender: formData.gender || null,
        date_of_birth: formData.date_of_birth || null,
        year_group: formData.year_group || null,
        house_number: formData.house_number || null,
        address: formData.address || null,
        post_code: formData.post_code || null,
        ethnic_origin: formData.ethnic_origin || null,
        other_language: formData.other_language || null,
        guardian_name: formData.guardian_name || null,
        guardian_email: formData.guardian_email || null,
        home_contact: formData.home_contact || null,
        mobile_contact: formData.mobile_contact || null,
        extra_tel: formData.extra_tel || null,
        last_madrasa: formData.last_madrasa || null,
        last_madrasa_address: formData.last_madrasa_address || null,
        reason_for_leaving: formData.reason_for_leaving || null,
        reading_level: formData.reading_level || null,
        medical_notes: formData.medical_notes || null,
        admission_date: formData.admission_date || null,
        stripe_customer_id: formData.stripe_customer_id || null,
        billing_email: formData.billing_email || null,
      };

      const { error } = await supabase
        .from("students")
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Student Added",
        description: `${formData.name} has been added successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["all-students-directory"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      
      resetForm();
      setOpen(false);
    } catch (error) {
      console.error("Error adding student:", error);
      toast({
        title: "Error",
        description: "Failed to add student. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className={`grid w-full ${isMobile ? "grid-cols-3 h-auto" : "grid-cols-5"}`}>
          <TabsTrigger value="basic" className="text-xs py-1.5">Basic</TabsTrigger>
          <TabsTrigger value="contact" className="text-xs py-1.5">Contact</TabsTrigger>
          <TabsTrigger value="education" className="text-xs py-1.5">Education</TabsTrigger>
          {isMobile && (
            <>
              <TabsTrigger value="billing" className="text-xs py-1.5">Billing</TabsTrigger>
              <TabsTrigger value="other" className="text-xs py-1.5">Other</TabsTrigger>
            </>
          )}
          {!isMobile && (
            <>
              <TabsTrigger value="billing" className="text-xs py-1.5">Billing</TabsTrigger>
              <TabsTrigger value="other" className="text-xs py-1.5">Other</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="basic" className="space-y-3 mt-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Full name"
                required
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="maktab" className="text-xs">Maktab *</Label>
                <Select value={formData.maktab} onValueChange={(v) => handleChange("maktab", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boys">Boys</SelectItem>
                    <SelectItem value="girls">Girls</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="student_group" className="text-xs">Group</Label>
                <Select value={formData.student_group} onValueChange={(v) => handleChange("student_group", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Group A</SelectItem>
                    <SelectItem value="B">Group B</SelectItem>
                    <SelectItem value="C">Group C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gender" className="text-xs">Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => handleChange("gender", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs">Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending_payment">Pending Payment</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date_of_birth" className="text-xs">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => handleChange("date_of_birth", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year_group" className="text-xs">Year Group</Label>
                <Input
                  id="year_group"
                  value={formData.year_group}
                  onChange={(e) => handleChange("year_group", e.target.value)}
                  placeholder="e.g., Year 5"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ethnic_origin" className="text-xs">Ethnic Origin</Label>
                <Input
                  id="ethnic_origin"
                  value={formData.ethnic_origin}
                  onChange={(e) => handleChange("ethnic_origin", e.target.value)}
                  placeholder="e.g., Pakistani"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="other_language" className="text-xs">Other Language</Label>
                <Input
                  id="other_language"
                  value={formData.other_language}
                  onChange={(e) => handleChange("other_language", e.target.value)}
                  placeholder="e.g., Urdu"
                  className="h-9"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contact" className="space-y-3 mt-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="guardian_name" className="text-xs">Guardian Name</Label>
              <Input
                id="guardian_name"
                value={formData.guardian_name}
                onChange={(e) => handleChange("guardian_name", e.target.value)}
                placeholder="Father/Guardian name"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guardian_email" className="text-xs">Guardian Email</Label>
              <Input
                id="guardian_email"
                type="email"
                value={formData.guardian_email}
                onChange={(e) => handleChange("guardian_email", e.target.value)}
                placeholder="email@example.com"
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="home_contact" className="text-xs">Home Contact</Label>
                <Input
                  id="home_contact"
                  value={formData.home_contact}
                  onChange={(e) => handleChange("home_contact", e.target.value)}
                  placeholder="+44..."
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mobile_contact" className="text-xs">Mobile</Label>
                <Input
                  id="mobile_contact"
                  value={formData.mobile_contact}
                  onChange={(e) => handleChange("mobile_contact", e.target.value)}
                  placeholder="+44..."
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extra_tel" className="text-xs">Extra Telephone</Label>
              <Input
                id="extra_tel"
                value={formData.extra_tel}
                onChange={(e) => handleChange("extra_tel", e.target.value)}
                placeholder="+44..."
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="house_number" className="text-xs">House Number</Label>
                <Input
                  id="house_number"
                  value={formData.house_number}
                  onChange={(e) => handleChange("house_number", e.target.value)}
                  placeholder="e.g., 42"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post_code" className="text-xs">Post Code</Label>
                <Input
                  id="post_code"
                  value={formData.post_code}
                  onChange={(e) => handleChange("post_code", e.target.value)}
                  placeholder="LU1 1TZ"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-xs">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Street address"
                className="h-9"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="education" className="space-y-3 mt-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reading_level" className="text-xs">Reading Level</Label>
                <Input
                  id="reading_level"
                  value={formData.reading_level}
                  onChange={(e) => handleChange("reading_level", e.target.value)}
                  placeholder="e.g., Qaidah"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admission_date" className="text-xs">Admission Date</Label>
                <Input
                  id="admission_date"
                  type="date"
                  value={formData.admission_date}
                  onChange={(e) => handleChange("admission_date", e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_madrasa" className="text-xs">Last Madrasa</Label>
              <Input
                id="last_madrasa"
                value={formData.last_madrasa}
                onChange={(e) => handleChange("last_madrasa", e.target.value)}
                placeholder="Previous madrasa name"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_madrasa_address" className="text-xs">Madrasa Address</Label>
              <Input
                id="last_madrasa_address"
                value={formData.last_madrasa_address}
                onChange={(e) => handleChange("last_madrasa_address", e.target.value)}
                placeholder="Previous madrasa address"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason_for_leaving" className="text-xs">Reason for Leaving</Label>
              <Input
                id="reason_for_leaving"
                value={formData.reason_for_leaving}
                onChange={(e) => handleChange("reason_for_leaving", e.target.value)}
                placeholder="Why they left"
                className="h-9"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-3 mt-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stripe_customer_id" className="text-xs">Stripe Customer ID</Label>
              <Input
                id="stripe_customer_id"
                value={formData.stripe_customer_id}
                onChange={(e) => handleChange("stripe_customer_id", e.target.value)}
                placeholder="cus_..."
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing_email" className="text-xs">Billing Email</Label>
              <Input
                id="billing_email"
                type="email"
                value={formData.billing_email}
                onChange={(e) => handleChange("billing_email", e.target.value)}
                placeholder="billing@example.com"
                className="h-9"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="other" className="space-y-3 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="medical_notes" className="text-xs">Medical Notes</Label>
            <Textarea
              id="medical_notes"
              value={formData.medical_notes}
              onChange={(e) => handleChange("medical_notes", e.target.value)}
              placeholder="Any medical conditions..."
              rows={4}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-3 border-t">
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isAdding} className="h-9">
          Cancel
        </Button>
        <Button type="submit" disabled={isAdding} className="h-9">
          {isAdding ? "Adding..." : "Add Student"}
        </Button>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button size="sm" className="h-8 px-2 sm:px-3">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Student</span>
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle>Add New Student</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="flex-1 px-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
            {formContent}
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};

export default AddStudentDialog;