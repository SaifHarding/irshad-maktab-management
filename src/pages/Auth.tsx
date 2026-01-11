import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/masjid-logo.png";
import { z } from "zod";
import { paths } from "@/lib/portalPaths";

const usernameSchema = z.string().trim().min(3, { message: "Username must be at least 3 characters" });
const passwordSchema = z.string().min(6, { message: "Password must be at least 6 characters" });

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // User is logged in, check if they need to change password
        const { data: profile } = await supabase
          .from("profiles")
          .select("must_change_password")
          .eq("id", session.user.id)
          .single();

        if (profile?.must_change_password) {
          setShowPasswordChange(true);
          setCheckingSession(false);
        } else {
          // Already logged in and no password change needed, redirect to teacher/admin home
          navigate(paths.home(), { replace: true });
        }
      } else {
        setCheckingSession(false);
      }
    };
    
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      usernameSchema.parse(username);
      passwordSchema.parse(password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.issues[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    // Username maps directly to email as username@maktab.local
    const email = `${username.toLowerCase()}@maktab.local`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Login Failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
      setLoading(false);
    } else {
      // Store session preference and expiry time
      const expiryDuration = keepSignedIn ? 180 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000; // 6 months or 12 hours in milliseconds
      const expiryTime = Date.now() + expiryDuration;
      
      localStorage.setItem('session_expiry', expiryTime.toString());
      localStorage.setItem('keep_signed_in', keepSignedIn.toString());
      
      // Check if user must change password
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", data.user.id)
        .single();

      if (profile?.must_change_password) {
        setShowPasswordChange(true);
        setLoading(false);
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate(paths.home());
      }
    }
  };

  const handlePasswordChange = async () => {
    try {
      passwordSchema.parse(newPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.issues[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Session expired",
          description: "Please log in again",
          variant: "destructive",
        });
        setShowPasswordChange(false);
        setChangingPassword(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('change-own-password', {
        body: { newPassword },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Password Change Failed",
          description: data.error,
          variant: "destructive",
        });
        setChangingPassword(false);
        return;
      }

      // Set session expiry for the new session (default to 12 hours if not set during login)
      if (!localStorage.getItem('session_expiry')) {
        const expiryDuration = 12 * 60 * 60 * 1000;
        localStorage.setItem('session_expiry', (Date.now() + expiryDuration).toString());
        localStorage.setItem('keep_signed_in', 'false');
      }

      toast({
        title: "Password Changed!",
        description: "Welcome! You are now logged in.",
      });

      setShowPasswordChange(false);
      setChangingPassword(false);
      navigate(paths.home(), { replace: true });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
      setChangingPassword(false);
    }
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <img src={logo} alt="Masjid Logo" className="w-32 h-32 mx-auto" />
          <h1 className="text-4xl font-bold text-foreground">Maktab Attendance</h1>
          <p className="text-muted-foreground">Teacher & Admin Login</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keep-signed-in"
                  checked={keepSignedIn}
                  onCheckedChange={(checked) => setKeepSignedIn(checked === true)}
                />
                <Label htmlFor="keep-signed-in" className="text-sm font-normal cursor-pointer">
                  Keep me signed in
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPasswordChange} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Change Your Password</DialogTitle>
            <DialogDescription>
              For security reasons, you must change your password before continuing. This is required for all new accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handlePasswordChange} 
              disabled={changingPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {changingPassword ? "Changing Password..." : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
