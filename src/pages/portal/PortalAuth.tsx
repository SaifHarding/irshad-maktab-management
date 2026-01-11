import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { portalSupabase as supabase } from "@/integrations/supabase/portalClient";
import { toast } from "@/hooks/use-toast";
import { Mail, Loader2, CheckCircle, Shield } from "lucide-react";
import logo from "@/assets/masjid-logo.png";

import { isPortalDomain } from "@/lib/portalPaths";

export default function PortalAuth() {
  const navigate = useNavigate();

  // Email login state
  const [email, setEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // User is already logged in, redirect to portal dashboard
        const portalHome = isPortalDomain ? "/" : "/portal";
        navigate(portalHome, { replace: true });
      } else {
        setCheckingSession(false);
      }
    };
    
    checkSession();
  }, [navigate]);

  // Navigate to teacher/admin auth page
  const handleTeacherLogin = () => {
    // On portal domain, teacher auth is at /app/auth
    // On main domain, teacher auth is at /auth
    const teacherAuthUrl = isPortalDomain ? "/app/auth" : "/auth";
    navigate(teacherAuthUrl);
  };

  const handleEmailLogin = async () => {
    if (!email.trim()) {
      toast({ title: "Please enter your email", variant: "destructive" });
      return;
    }

    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("parent-login-email", {
        body: { email: email.trim().toLowerCase() },
      });

      if (error) throw error;

      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
        return;
      }

      setEmailSent(true);
      toast({ title: "Login link sent! Check your email." });
    } catch (error) {
      console.error("Error sending email login:", error);
      toast({ title: "Failed to send magic link", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const resetEmail = () => {
    setEmail("");
    setEmailSent(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col p-4">
      {/* Admin/Teacher Login Button */}
      <div className="absolute top-4 left-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleTeacherLogin}
          className="flex items-center gap-2"
        >
          <Shield className="h-4 w-4" />
          Admin / Teacher Login
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={logo} alt="Masjid Logo" className="w-32 h-32 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground">Parent Portal</h1>
            <p className="text-muted-foreground mt-2">Access your child's attendance and progress</p>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Sign In
              </CardTitle>
              <CardDescription>
                Enter your registered email address and we'll send you a login link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailSent ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Check Your Email</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    We've sent a login link to {email}. 
                    Click the link in the email to sign in.
                  </p>
                  <Button variant="outline" onClick={resetEmail}>
                    Try a different email
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
                    />
                  </div>
                  <Button 
                    onClick={handleEmailLogin}
                    disabled={sendingEmail || !email.trim()}
                    className="w-full"
                  >
                    {sendingEmail ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Login Link"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              Need help or help signing up?
            </p>
            <p className="text-sm text-foreground font-medium">
              Please contact Maktab Administration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}