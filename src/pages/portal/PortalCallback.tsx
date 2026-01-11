import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { portalSupabase as supabase } from "@/integrations/supabase/portalClient";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";
import { isPortalDomain } from "@/lib/portalPaths";

export default function PortalCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    const handleCallback = async () => {
      const portalOrigin = isPortalDomain
        ? window.location.origin
        : "https://portal.masjidirshad.co.uk";
      const portalPrefix = isPortalDomain ? "" : "/portal";

      try {
        // If Supabase redirected back with an error in the hash, do not attempt session creation.
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const hashError = hashParams.get("error");
        const hashErrorCode = hashParams.get("error_code");
        const hashErrorDescription = hashParams.get("error_description");

        if (hashError) {
          // Redirect to dedicated expired page for otp_expired, otherwise auth page
          if (hashErrorCode === "otp_expired") {
            window.location.replace(`${portalOrigin}${portalPrefix}/link-expired`);
          } else {
            const friendly = decodeURIComponent(
              hashErrorDescription || "Sign-in failed. Please try again."
            );
            setStatus("error");
            setMessage(friendly);
            toast({
              title: "Sign in failed",
              description: friendly,
              variant: "destructive",
            });
            setTimeout(() => {
              window.location.replace(`${portalOrigin}${portalPrefix}/auth`);
            }, 1200);
          }
          return;
        }

        // Get the session from the URL hash (magic link)
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          throw new Error("Failed to retrieve session");
        }

        if (!session) {
          // If no session yet, wait a moment and try again
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const {
            data: { session: retrySession },
          } = await supabase.auth.getSession();

          if (!retrySession) {
            throw new Error("No session found. The link may have expired.");
          }
        }

        setMessage("Setting up your account...");

        // Complete the parent registration (create profile, link students)
        const { data, error } = await supabase.functions.invoke("complete-parent-registration");

        if (error) {
          console.error("Registration error:", error);
          throw new Error("Failed to complete registration");
        }

        if (data.error) {
          throw new Error(data.error);
        }

        setStatus("success");
        setMessage(`Welcome! ${data.total_students} student(s) linked to your account.`);

        toast({
          title: "Sign in successful!",
          description: `${data.total_students} student(s) linked to your account.`,
        });

        // Redirect to portal (session is stored in shared cookie storage)
        setTimeout(() => {
          window.location.replace(`${portalOrigin}${portalPrefix}/`);
        }, 800);
      } catch (error) {
        console.error("Callback error:", error);
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Something went wrong");

        toast({
          title: "Sign in failed",
          description: error instanceof Error ? error.message : "Something went wrong",
          variant: "destructive",
        });

        // Redirect to portal sign-in page after delay
        setTimeout(() => {
          window.location.replace(`${portalOrigin}${portalPrefix}/auth`);
        }, 1500);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        {status === "processing" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <p className="text-foreground font-medium">{message}</p>
            <p className="text-muted-foreground text-sm mt-2">Redirecting to portal...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">!</span>
            </div>
            <p className="text-destructive font-medium">{message}</p>
            <p className="text-muted-foreground text-sm mt-2">Redirecting to sign in...</p>
          </>
        )}
      </div>
    </div>
  );
}
