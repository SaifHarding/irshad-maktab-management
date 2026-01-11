import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/masjid-logo.png";
import { z } from "zod";
import { paths } from "@/lib/portalPaths";

const usernameSchema = z.string().trim().min(3).max(20);
const passwordSchema = z.string().min(6);
const nameSchema = z.string().trim().min(1);

const InitialSetup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      usernameSchema.parse(username);
      passwordSchema.parse(password);
      nameSchema.parse(fullName);
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

    try {
      console.log('Calling create-initial-admin');
      
      const { data, error } = await supabase.functions.invoke('create-initial-admin', {
        body: { username, password, fullName },
      });

      console.log('Edge function response:', data);

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Admin Created!",
        description: `Welcome ${username}! You can now log in with your credentials.`,
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate(paths.auth());
      }, 2000);
    } catch (error: any) {
      console.error('Error creating admin:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create admin user",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <img src={logo} alt="Masjid Logo" className="w-32 h-32 mx-auto" />
          <h1 className="text-4xl font-bold text-foreground">Initial Setup</h1>
          <p className="text-muted-foreground">Create your first admin account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Admin Account</CardTitle>
            <CardDescription>
              This is a one-time setup. After creating your admin account, you can create additional users through the Admin Panel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
                <p className="text-xs text-muted-foreground">3-20 characters, lowercase recommended</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="Your Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
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
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating Admin..." : "Create Admin Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InitialSetup;
