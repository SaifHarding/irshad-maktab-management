import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Send, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { paths } from "@/lib/portalPaths";

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  functionName: string;
  defaultPayload: Record<string, unknown>;
  maktabField?: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "payment-link",
    name: "Payment Link",
    description: "Stripe payment link sent after registration approval",
    functionName: "send-payment-link",
    maktabField: "maktab",
    defaultPayload: {
      guardianEmail: "",
      guardianName: "Test Guardian",
      students: [
        {
          id: "test-123",
          firstName: "Ahmad",
          lastName: "Test",
          maktab: "boys",
        }
      ],
      maktab: "boys",
    },
  },
  {
    id: "payment-confirmation",
    name: "Payment Confirmation",
    description: "Sent after successful Stripe payment",
    functionName: "send-payment-confirmation",
    maktabField: "maktab",
    defaultPayload: {
      guardianEmail: "",
      guardianName: "Test Guardian",
      studentName: "Ahmad Test",
      studentCode: "B-TEST-001",
      maktab: "boys",
    },
  },
  {
    id: "registration-confirmation",
    name: "Registration Approved",
    description: "Sent when admin approves a registration",
    functionName: "send-registration-confirmation",
    maktabField: "students[0].maktab",
    defaultPayload: {
      guardianEmail: "",
      guardianName: "Test Guardian",
      students: [
        {
          name: "Ahmad Test",
          code: "B-TEST-001",
          maktab: "boys",
          isHifz: false,
        }
      ],
    },
  },
  {
    id: "registration-rejection",
    name: "Registration Rejected",
    description: "Sent when admin rejects a registration",
    functionName: "send-registration-rejection",
    defaultPayload: {
      guardianEmail: "",
      guardianName: "Test Guardian",
      studentName: "Ahmad Test",
      rejectionReason: "Unfortunately, we are unable to accept this registration at this time due to capacity limitations.",
    },
  },
  {
    id: "parent-magic-link",
    name: "Parent Portal Login",
    description: "Magic link email for parent portal access (requires registered email)",
    functionName: "parent-login-email",
    defaultPayload: {
      email: "",
      guardianName: "Test Guardian",
    },
  },
];

export default function EmailTesting() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [payload, setPayload] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [selectedMaktab, setSelectedMaktab] = useState<string>("boys");

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      // Deep clone and update email fields
      const payloadCopy = JSON.parse(JSON.stringify(template.defaultPayload));
      
      // Set email fields to recipient
      if (payloadCopy.guardianEmail !== undefined) {
        payloadCopy.guardianEmail = recipientEmail;
      }
      if (payloadCopy.email !== undefined) {
        payloadCopy.email = recipientEmail;
      }

      // Update maktab based on selection
      updatePayloadMaktab(payloadCopy, selectedMaktab);
      
      setPayload(JSON.stringify(payloadCopy, null, 2));
    }
  };

  const updatePayloadMaktab = (payloadObj: Record<string, unknown>, maktab: string) => {
    // Update direct maktab field
    if (payloadObj.maktab !== undefined) {
      payloadObj.maktab = maktab;
    }
    // Update students array
    if (Array.isArray(payloadObj.students)) {
      payloadObj.students.forEach((student: Record<string, unknown>) => {
        if (student.maktab !== undefined) {
          student.maktab = maktab;
        }
      });
    }
    // Update student code prefix
    if (typeof payloadObj.studentCode === "string") {
      payloadObj.studentCode = maktab === "boys" ? "B-TEST-001" : "G-TEST-001";
    }
    if (Array.isArray(payloadObj.students)) {
      payloadObj.students.forEach((student: Record<string, unknown>, idx: number) => {
        if (typeof student.code === "string") {
          student.code = maktab === "boys" ? `B-TEST-00${idx + 1}` : `G-TEST-00${idx + 1}`;
        }
      });
    }
  };

  const handleMaktabChange = (maktab: string) => {
    setSelectedMaktab(maktab);
    if (payload) {
      try {
        const payloadObj = JSON.parse(payload);
        updatePayloadMaktab(payloadObj, maktab);
        setPayload(JSON.stringify(payloadObj, null, 2));
      } catch {
        // Invalid JSON, ignore
      }
    }
  };

  const handleRecipientChange = (email: string) => {
    setRecipientEmail(email);
    if (payload) {
      try {
        const payloadObj = JSON.parse(payload);
        if (payloadObj.guardianEmail !== undefined) {
          payloadObj.guardianEmail = email;
        }
        if (payloadObj.email !== undefined) {
          payloadObj.email = email;
        }
        setPayload(JSON.stringify(payloadObj, null, 2));
      } catch {
        // Invalid JSON, ignore
      }
    }
  };

  const handleSendTest = async () => {
    if (!selectedTemplate) {
      toast({
        title: "Select a template",
        description: "Please select an email template to test",
        variant: "destructive",
      });
      return;
    }

    if (!recipientEmail) {
      toast({
        title: "Enter recipient email",
        description: "Please enter an email address to send the test to",
        variant: "destructive",
      });
      return;
    }

    const template = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      toast({
        title: "Invalid JSON",
        description: "The payload is not valid JSON. Please fix it and try again.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke(template.functionName, {
        body: parsedPayload,
      });

      if (error) {
        // Try to get more details from the error context
        let errorMessage = error.message;
        try {
          const errorContext = error.context as { body?: string } | undefined;
          if (errorContext?.body) {
            const parsed = JSON.parse(errorContext.body);
            errorMessage = parsed.error || parsed.message || errorMessage;
          }
        } catch {
          // Ignore parsing errors
        }
        throw new Error(errorMessage);
      }

      toast({
        title: "Test email sent!",
        description: `${template.name} email sent to ${recipientEmail}`,
      });

      console.log("Email response:", data);
    } catch (error: unknown) {
      console.error("Error sending test email:", error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "An error occurred while sending the test email",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const currentTemplate = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to={paths.admin()}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold">Email Testing</h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* Configuration Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Test Configuration</CardTitle>
              <CardDescription>
                Select an email template and configure where to send the test
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recipient Email */}
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Email *</Label>
                <Input
                  id="recipient"
                  type="email"
                  placeholder="your@email.com"
                  value={recipientEmail}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Test emails will be sent to this address
                </p>
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <Label htmlFor="template">Email Template *</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TEMPLATES.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentTemplate && (
                  <p className="text-xs text-muted-foreground">
                    {currentTemplate.description}
                  </p>
                )}
              </div>

              {/* Maktab Selection */}
              {currentTemplate?.maktabField && (
                <div className="space-y-2">
                  <Label htmlFor="maktab">Maktab</Label>
                  <Select value={selectedMaktab} onValueChange={handleMaktabChange}>
                    <SelectTrigger id="maktab">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boys">Boys Maktab</SelectItem>
                      <SelectItem value="girls">Girls Maktab</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This affects contact details shown in the email
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payload Editor Card */}
          {selectedTemplate && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Email Data (JSON)</CardTitle>
                <CardDescription>
                  Customize the data sent to the email function
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  className="font-mono text-sm min-h-[200px] sm:min-h-[300px]"
                  placeholder="{ }"
                />
                <p className="text-xs text-muted-foreground">
                  Edit the JSON above to customize the test email content
                </p>
              </CardContent>
            </Card>
          )}

          {/* Send Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSendTest}
              disabled={!selectedTemplate || !recipientEmail || sending}
              className="w-full sm:w-auto"
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Email
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
