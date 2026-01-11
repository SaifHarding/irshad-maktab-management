import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { portalSupabase as supabase } from "@/integrations/supabase/portalClient";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLinkedStudents, useParentProfile } from "@/hooks/useParentData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { MapPin, Save, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AddressLookup } from "@/components/portal/AddressLookup";

export default function PortalProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: profile, isLoading: profileLoading } = useParentProfile();
  const { data: students, isLoading: studentsLoading } = useLinkedStudents();

  // Form state for parent profile
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  // Form state for student contact (first student)
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [homeContact, setHomeContact] = useState("");
  const [mobileContact, setMobileContact] = useState("");
  const [address, setAddress] = useState("");
  const [postCode, setPostCode] = useState("");
  const [backupContact, setBackupContact] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/portal/auth", { replace: true });
      } else {
        setIsAuthenticated(true);
      }
    });
  }, [navigate]);

  // Initialize form with data
  useEffect(() => {
    if (profile) {
      setParentName(profile.full_name || "");
      setParentPhone(profile.phone || "");
    }
  }, [profile]);

  useEffect(() => {
    if (students && students.length > 0) {
      const student = students[0];
      setGuardianName(student.guardian_name || "");
      setGuardianEmail(student.guardian_email || "");
      setHomeContact(student.home_contact || "");
      setMobileContact(student.mobile_contact || "");
      setBackupContact(student.extra_tel || "");
      setAddress(student.address || "");
      setPostCode(student.post_code || "");
    }
  }, [students]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update parent profile
      const { error: profileError } = await supabase
        .from("parent_profiles")
        .update({
          full_name: parentName || null,
          phone: parentPhone || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update student contact info (for all linked students)
      if (students && students.length > 0) {
        for (const student of students) {
          const { error: studentError } = await supabase
            .from("students")
            .update({
              guardian_name: guardianName || null,
              guardian_email: guardianEmail || null,
              home_contact: homeContact || null,
              mobile_contact: mobileContact || null,
              extra_tel: backupContact || null,
              address: address || null,
              post_code: postCode || null,
            })
            .eq("id", student.id);

          if (studentError) {
            console.error("Error updating student:", studentError);
          }
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["parent-profile"] });
      queryClient.invalidateQueries({ queryKey: ["linked-students"] });

      toast({ title: "Profile updated successfully" });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({ title: "Failed to update profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isLoading = profileLoading || studentsLoading;

  return (
    <PortalLayout title="Profile">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Emergency Contact Details</h2>
          <p className="text-muted-foreground mt-1">
            This information will be used in case of an emergency. Please ensure your contact details are up to date.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>

            {/* Student Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Emergency Contact Details
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  These details will be used to contact you in case of an emergency at the Maktab.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guardianName">Parent/Guardian Name</Label>
                    <Input
                      id="guardianName"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Guardian's full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianEmail">Parent/Guardian Email</Label>
                    <Input
                      id="guardianEmail"
                      type="email"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      placeholder="Guardian's email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mobileContact">Primary Mobile Phone</Label>
                    <Input
                      id="mobileContact"
                      value={mobileContact}
                      onChange={(e) => setMobileContact(e.target.value)}
                      placeholder="Primary contact number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backupContact">Backup Contact Number</Label>
                    <Input
                      id="backupContact"
                      value={backupContact}
                      onChange={(e) => setBackupContact(e.target.value)}
                      placeholder="Alternative contact number"
                    />
                    <p className="text-xs text-muted-foreground">
                      A secondary number we can call if we cannot reach the primary contact.
                    </p>
                  </div>
                </div>

                <AddressLookup
                  postCode={postCode}
                  address={address}
                  onPostCodeChange={setPostCode}
                  onAddressChange={setAddress}
                />
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
