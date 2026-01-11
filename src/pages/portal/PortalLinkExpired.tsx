import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, RefreshCw, BookOpen } from "lucide-react";

export default function PortalLinkExpired() {
  const navigate = useNavigate();

  const handleRequestNewLink = () => {
    window.location.replace("https://portal.masjidirshad.co.uk/portal/auth");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <Clock className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Link Expired</h1>
          <p className="text-muted-foreground mt-2">
            This sign-in link has expired or is no longer valid.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Magic links expire after 1 hour for security reasons.</p>
              <p>This can happen if:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>The link was clicked after it expired</li>
                <li>The link was already used to sign in</li>
                <li>You requested a new link (which invalidates old ones)</li>
              </ul>
            </div>

            <Button 
              onClick={handleRequestNewLink} 
              className="w-full"
              size="lg"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Request New Link
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You'll be taken to the sign-in page to request a fresh link.
            </p>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <span>Masjid Irshad Parent Portal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
