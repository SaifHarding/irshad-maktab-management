import { useNavigate } from "react-router-dom";
import { useParentProfile, useLinkedStudents } from "@/hooks/useParentData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight, User, Phone, MapPin } from "lucide-react";

export function ActionItemsBanner() {
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading } = useParentProfile();
  const { data: students, isLoading: studentsLoading } = useLinkedStudents();

  if (profileLoading || studentsLoading) {
    return null;
  }

  // Check for missing information
  const missingItems: { icon: React.ReactNode; label: string }[] = [];

  // Check first student for contact info
  const student = students?.[0];

  // Check parent profile for name - also consider student's guardian_name as fallback
  const hasName = profile?.full_name || student?.guardian_name;
  if (!hasName) {
    missingItems.push({ icon: <User className="h-4 w-4" />, label: "Name" });
  }

  // Check student for mobile and address
  if (student) {
    if (!student.mobile_contact && !student.home_contact) {
      missingItems.push({ icon: <Phone className="h-4 w-4" />, label: "Phone number" });
    }
    if (!student.address) {
      missingItems.push({ icon: <MapPin className="h-4 w-4" />, label: "Address" });
    }
  }

  // Don't show banner if all info is complete
  if (missingItems.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-warning/10 via-warning/5 to-warning/10 border-warning/30">
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Complete Your Emergency Contact Details</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                This information is required in case of an emergency. Please update:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {missingItems.map((item, idx) => (
                  <span 
                    key={idx} 
                    className="inline-flex items-center gap-1.5 text-xs bg-warning/20 text-warning-foreground px-2 py-1 rounded-full"
                  >
                    {item.icon}
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Button 
            onClick={() => navigate("/portal/profile")}
            className="bg-warning hover:bg-warning/90 text-warning-foreground shrink-0"
          >
            Update Profile
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
