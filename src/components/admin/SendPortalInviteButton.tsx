import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Mail, Loader2, CheckCircle, AlertCircle, Pencil, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface SendPortalInviteButtonProps {
  studentCode: string;
  studentName: string;
  guardianEmail: string | null;
  lastInviteEmail?: string | null;
  lastInviteSentAt?: string | null;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  onInviteSent?: () => void;
}

export function SendPortalInviteButton({
  studentCode,
  studentName,
  guardianEmail,
  lastInviteEmail,
  lastInviteSentAt,
  className,
  size = "sm",
  onInviteSent,
}: SendPortalInviteButtonProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState(guardianEmail || lastInviteEmail || "");
  const [isEditing, setIsEditing] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setEmail(lastInviteEmail || guardianEmail || "");
      setIsEditing(false);
      setSent(false);
    }
  };

  const handleSendInvite = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      toast({ title: "Please enter an email address", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-parent-magic-link", {
        body: { student_code: studentCode, email_override: targetEmail },
      });

      if (error) throw error;

      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
        return;
      }

      setSent(true);
      toast({ title: `Portal invite sent to ${targetEmail}` });
      onInviteSent?.();
    } catch (error) {
      console.error("Error sending invite:", error);
      toast({ title: "Failed to send invite", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const resetAndClose = () => {
    setSent(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size={size} className={className}>
          <Mail className="h-4 w-4 mr-1.5" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>Send Portal Invite</DialogTitle>
          <DialogDescription>
            Send a magic link to the parent/guardian to access the student portal.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Invite Sent!</h3>
            <p className="text-muted-foreground text-sm mb-4">
              A magic link has been sent to <strong>{email}</strong>
            </p>
            <Button onClick={resetAndClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Student</span>
                <span className="text-sm font-medium">{studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Code</span>
                <span className="text-sm font-mono">{studentCode}</span>
              </div>
              {lastInviteSentAt && (
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last invite
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-medium block">
                      {lastInviteEmail}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(lastInviteSentAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="invite-email">Email Address</Label>
                {!isEditing && guardianEmail && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              {isEditing || !guardianEmail ? (
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="parent@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                />
              ) : (
                <div className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                  <span className="text-sm">{email}</span>
                </div>
              )}
              {!guardianEmail && (
                <p className="text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  No guardian email on file. Please enter an email address.
                </p>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              The parent will receive an email with a magic link to sign in and access the portal.
            </p>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendInvite} disabled={sending || !email.trim()}>
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invite
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
