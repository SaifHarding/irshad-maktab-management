import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, LockOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/masjid-logo.png";

interface AdminLockProps {
  onUnlock: () => void;
}

const AdminLock = ({ onUnlock }: AdminLockProps) => {
  const [password, setPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const { toast } = useToast();
  const ADMIN_PASSWORD = "maktab2025"; // Change this to your desired password

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem("maktab_admin_unlocked", "true");
      setIsUnlocking(true);
      toast({
        title: "Access Granted",
        description: "Welcome to Maktab Attendance",
      });
      
      // Play unlock animation then load app
      setTimeout(() => {
        onUnlock();
      }, 1200);
    } else {
      toast({
        title: "Access Denied",
        description: "Incorrect password",
        variant: "destructive",
      });
      setPassword("");
    }
  };

  return (
    <div 
      className={`min-h-screen bg-background flex flex-col items-center justify-center p-4 transition-all duration-700 ${
        isUnlocking ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
    >
      <div className={`space-y-8 w-full max-w-md transition-all duration-500 ${
        isUnlocking ? 'scale-110 opacity-0' : 'scale-100 opacity-100'
      }`}>
        <div className="text-center space-y-6">
          <img 
            src={logo} 
            alt="Masjid Logo" 
            className={`w-40 h-40 mx-auto transition-all duration-700 ${
              isUnlocking ? 'scale-150 rotate-12' : 'scale-100 rotate-0'
            }`}
          />
          <div className={`flex items-center justify-center gap-3 transition-all duration-500 ${
            isUnlocking ? 'scale-150' : 'scale-100'
          }`}>
            {isUnlocking ? (
              <LockOpen className="w-12 h-12 text-green-500 animate-pulse" />
            ) : (
              <Lock className="w-12 h-12 text-muted-foreground" />
            )}
          </div>
          <h1 className="text-4xl font-bold text-foreground">
            {isUnlocking ? "Access Granted" : "Admin Access Required"}
          </h1>
          <p className="text-muted-foreground text-lg">
            {isUnlocking ? "Loading..." : "Enter password to continue"}
          </p>
        </div>

        {!isUnlocking && (
          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
            <Input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 text-lg text-center"
              autoFocus
            />
            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-xl font-semibold touch-manipulation"
            >
              Unlock
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminLock;
