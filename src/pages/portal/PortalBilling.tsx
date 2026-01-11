import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { portalSupabase as supabase } from "@/integrations/supabase/portalClient";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLinkedStudents } from "@/hooks/useParentData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ExternalLink, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PortalBilling() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loadingPortal, setLoadingPortal] = useState<string | null>(null);

  const { data: students, isLoading } = useLinkedStudents();

  const handleManagePayment = async (customerId: string, maktab: string) => {
    setLoadingPortal(customerId);
    try {
      const response = await supabase.functions.invoke("create-customer-portal-session", {
        body: {
          customer_id: customerId,
          maktab,
          return_url: window.location.href,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to open payment portal");
      }

      const url = response.data?.url;
      if (!url) {
        throw new Error("No portal URL returned");
      }

      // Stripe billing portal cannot be embedded in an iframe (X-Frame-Options).
      // Never navigate this tab; always open a new tab/window.
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (!newWindow) {
        toast.error("Popup blocked — please allow popups to manage payments.");
      }
    } catch (error: any) {
      console.error("Error opening payment portal:", error);
      toast.error("Unable to open payment portal. Please try again.");
    } finally {
      setLoadingPortal(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/portal/auth", { replace: true });
      } else {
        setIsAuthenticated(true);
      }
    });
  }, [navigate]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check if any student has a Stripe customer ID
  const studentsWithStripe = students?.filter((s) => s.stripe_customer_id) || [];
  const hasStripeAccount = studentsWithStripe.length > 0;

  return (
    <PortalLayout title="Billing">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Billing & Payments</h2>
          <p className="text-muted-foreground mt-1">
            Manage your payment information and view payment history.
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : hasStripeAccount ? (
          <div className="space-y-4">
            {studentsWithStripe.map((student) => (
              <Card key={student.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      {student.name}
                    </div>
                    <Badge variant="default" className="bg-success">
                      Active
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Student Code:</span>
                    <Badge variant="outline">{student.student_code}</Badge>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Payment account is set up. Use the button below to manage your payment methods,
                    view invoices, and update billing information.
                  </p>

                  <div>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() =>
                        handleManagePayment(student.stripe_customer_id!, student.maktab)
                      }
                      disabled={loadingPortal === student.stripe_customer_id}
                    >
                      {loadingPortal === student.stripe_customer_id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="mr-2 h-4 w-4" />
                      )}
                      Manage Payment Details
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1.5">Opens in a new tab</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No Payment Account</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                  There is no payment account linked to your children's records. If you believe this
                  is an error or need to set up payments, please contact the school administration.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-left max-w-sm mx-auto">
                  <p className="text-sm font-medium mb-2">Contact Information</p>
                  <p className="text-sm text-muted-foreground">
                    Masjid-e-Irshad<br />
                    Email: info@masjidirshad.co.uk<br />
                    Phone: Contact the school office
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Info Card */}
        <Card className="bg-accent/30 border-accent">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">About Payments</p>
                <p className="text-sm text-muted-foreground">
                  All payments are processed securely through Stripe. Your payment information is
                  never stored on our servers.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

