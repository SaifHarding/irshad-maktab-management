import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Home, Send, X, Megaphone, Clock, Calendar, CheckCircle, AlertCircle, Trash2, History, Globe } from "lucide-react";
import { paths } from "@/lib/portalPaths";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import WebsiteEventsManager from "@/components/admin/WebsiteEventsManager";

interface Announcement {
  id: string;
  subject: string;
  message: string;
  image_url: string | null;
  maktab_filter: string;
  scheduled_at: string | null;
  sent_at: string | null;
  status: string;
  emails_sent: number;
  emails_failed: number;
  created_by_name: string;
  created_at: string;
  expires_at: string | null;
}

const Announcements = () => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [maktabFilter, setMaktabFilter] = useState<"all" | "boys" | "girls">("all");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Scheduling
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  
  // Expiry
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryTime, setExpiryTime] = useState("23:59");
  
  // Publish to website
  const [publishToWebsite, setPublishToWebsite] = useState(false);
  const [eventDate, setEventDate] = useState("");
  
  // History
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching announcements:", error);
    } else {
      setAnnouncements(data || []);
    }
    setLoadingHistory(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 5MB",
          variant: "destructive",
        });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      toast({ title: "Please enter a subject", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Please enter a message", variant: "destructive" });
      return;
    }
    if (isScheduled && !scheduledDate) {
      toast({ title: "Please select a date for scheduling", variant: "destructive" });
      return;
    }

    setSending(true);
    let imageUrl: string | undefined;

    try {
      // Upload image if present
      if (imageFile) {
        setUploading(true);
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("announcement-attachments")
          .upload(fileName, imageFile);

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from("announcement-attachments")
          .getPublicUrl(fileName);

        imageUrl = publicUrlData.publicUrl;
        setUploading(false);
      }

      // Build scheduled datetime if scheduling
      let scheduledAt: string | undefined;
      if (isScheduled && scheduledDate) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      // Build expiry datetime if set
      let expiresAt: string | undefined;
      if (hasExpiry && expiryDate) {
        expiresAt = new Date(`${expiryDate}T${expiryTime}`).toISOString();
      }

      // Send announcement
      const { data, error } = await supabase.functions.invoke("send-announcement", {
        body: { subject, message, imageUrl, maktabFilter, scheduledAt, expiresAt },
      });

      if (error) throw error;

      // Also publish to website if enabled
      if (publishToWebsite) {
        const { data: userData } = await supabase.auth.getUser();
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userData.user?.id)
          .single();

        const { error: websiteError } = await supabase.from("website_events").insert({
          title: subject,
          description: message,
          image_url: imageUrl || null,
          event_date: eventDate || null,
          is_published: true,
          expires_at: expiresAt || null,
          created_by: userData.user?.id,
          created_by_name: profileData?.full_name || "Unknown",
        });

        if (websiteError) {
          console.error("Failed to create website event:", websiteError);
          toast({
            title: "Warning",
            description: "Announcement sent but failed to publish to website",
            variant: "destructive",
          });
        }
      }

      if (data?.success) {
        const websiteNote = publishToWebsite ? " Also published to website." : "";
        if (data.scheduled) {
          toast({
            title: "Announcement Scheduled!",
            description: data.message + websiteNote,
          });
        } else {
          toast({
            title: "Announcement Sent!",
            description: `${data.emailsSent} email(s) sent, ${data.notificationsCreated} notification(s) created.${websiteNote}`,
          });
        }
        // Reset form
        setSubject("");
        setMessage("");
        setImageFile(null);
        setImagePreview(null);
        setMaktabFilter("all");
        setIsScheduled(false);
        setScheduledDate("");
        setScheduledTime("09:00");
        setHasExpiry(false);
        setExpiryDate("");
        setExpiryTime("23:59");
        setPublishToWebsite(false);
        setEventDate("");
        // Refresh history
        fetchAnnouncements();
      } else {
        throw new Error(data?.error || "Failed to send announcement");
      }
    } catch (error: any) {
      console.error("Error sending announcement:", error);
      toast({
        title: "Failed to send announcement",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Announcement deleted" });
      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: "Failed to delete",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (announcement: Announcement) => {
    switch (announcement.status) {
      case "sent":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case "scheduled":
        return (
          <Badge variant="secondary" className="bg-blue-600 text-white">
            <Clock className="h-3 w-3 mr-1" />
            Scheduled
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const getExpiryBadge = (announcement: Announcement) => {
    if (!announcement.expires_at) return null;
    
    const expiresAt = new Date(announcement.expires_at);
    const now = new Date();
    const isExpired = expiresAt < now;
    
    if (isExpired) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Expired
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-orange-600 border-orange-300">
        <Clock className="h-3 w-3 mr-1" />
        Expires: {format(expiresAt, "MMM d")}
      </Badge>
    );
  };

  const getMaktabLabel = (filter: string) => {
    switch (filter) {
      case "boys":
        return "Boys";
      case "girls":
        return "Girls";
      default:
        return "All";
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 safe-top safe-bottom">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to={paths.admin()}>
              <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-5 w-5 sm:h-6 sm:w-6" />
              Announcements
            </h1>
          </div>
          <Link to={paths.home()}>
            <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
              <Home className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="compose" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compose" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Send className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Compose</span>
              <span className="xs:hidden">New</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <History className="h-3 w-3 sm:h-4 sm:w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="website" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
              Website
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4 mt-4">
            {/* Announcement Form */}
            <Card>
              <CardHeader>
                <CardTitle>Send Announcement</CardTitle>
                <CardDescription>
                  Send an email and portal notification to registered parents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maktab">Send To</Label>
                  <Select value={maktabFilter} onValueChange={(v) => setMaktabFilter(v as typeof maktabFilter)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Parents</SelectItem>
                      <SelectItem value="boys">Boys Maktab Parents Only</SelectItem>
                      <SelectItem value="girls">Girls Maktab Parents Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    placeholder="Enter announcement subject..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    placeholder="Write your announcement message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Image Attachment (optional)</Label>
                  {imagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-w-full max-h-48 rounded-lg border"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={removeImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="cursor-pointer"
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Max file size: 5MB</p>
                </div>

                {/* Schedule toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="schedule-toggle" className="cursor-pointer">Schedule for later</Label>
                      <p className="text-xs text-muted-foreground">Send at a specific date and time</p>
                    </div>
                  </div>
                  <Switch
                    id="schedule-toggle"
                    checked={isScheduled}
                    onCheckedChange={setIsScheduled}
                  />
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border bg-muted/30">
                    <div className="space-y-2">
                      <Label htmlFor="schedule-date">Date *</Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={today}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schedule-time">Time *</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Expiry toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="expiry-toggle" className="cursor-pointer">Set expiry date</Label>
                      <p className="text-xs text-muted-foreground">Automatically hide from portal after this date</p>
                    </div>
                  </div>
                  <Switch
                    id="expiry-toggle"
                    checked={hasExpiry}
                    onCheckedChange={setHasExpiry}
                  />
                </div>

                {hasExpiry && (
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border bg-muted/30">
                    <div className="space-y-2">
                      <Label htmlFor="expiry-date">Expiry Date *</Label>
                      <Input
                        id="expiry-date"
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        min={today}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiry-time">Expiry Time *</Label>
                      <Input
                        id="expiry-time"
                        type="time"
                        value={expiryTime}
                        onChange={(e) => setExpiryTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Publish to website toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 border-primary/30">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-primary" />
                    <div>
                      <Label htmlFor="website-toggle" className="cursor-pointer">Also publish to website</Label>
                      <p className="text-xs text-muted-foreground">Add this event to masjidirshad.co.uk carousel</p>
                    </div>
                  </div>
                  <Switch
                    id="website-toggle"
                    checked={publishToWebsite}
                    onCheckedChange={setPublishToWebsite}
                  />
                </div>

                {publishToWebsite && (
                  <div className="p-4 rounded-lg border bg-muted/30 border-primary/30">
                    <div className="space-y-2">
                      <Label htmlFor="event-date">Event Date (optional)</Label>
                      <Input
                        id="event-date"
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        min={today}
                      />
                      <p className="text-xs text-muted-foreground">
                        Shows as a date badge on the website event
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSend}
                  disabled={sending || !subject.trim() || !message.trim() || (isScheduled && !scheduledDate)}
                  className="w-full"
                >
                  {uploading ? (
                    <>Uploading image...</>
                  ) : sending ? (
                    <>Processing...</>
                  ) : isScheduled ? (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Schedule Announcement
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <Megaphone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>What happens when you send an announcement:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>An email is sent to all registered parents in the selected group</li>
                      <li>A notification appears in each parent's portal dashboard</li>
                      <li>Image attachments are included in the email</li>
                      <li>Scheduled announcements will be sent at the specified time</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Announcement History
                </CardTitle>
                <CardDescription>
                  View previously sent and scheduled announcements
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No announcements yet
                  </div>
                ) : (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-4">
                      {announcements.map((announcement) => (
                        <div
                          key={announcement.id}
                          className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                {getStatusBadge(announcement)}
                                <Badge variant="outline">{getMaktabLabel(announcement.maktab_filter)}</Badge>
                                {getExpiryBadge(announcement)}
                                {announcement.status === "sent" && (
                                  <span className="text-xs text-muted-foreground">
                                    {announcement.emails_sent} sent, {announcement.emails_failed} failed
                                  </span>
                                )}
                              </div>
                              <h4 className="font-semibold truncate">{announcement.subject}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-3 mt-1 whitespace-pre-wrap">
                                {announcement.message}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span>By {announcement.created_by_name}</span>
                                {announcement.scheduled_at && announcement.status === "scheduled" ? (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Scheduled: {format(new Date(announcement.scheduled_at), "MMM d, yyyy 'at' h:mm a")}
                                  </span>
                                ) : announcement.sent_at ? (
                                  <span>
                                    Sent: {format(new Date(announcement.sent_at), "MMM d, yyyy 'at' h:mm a")}
                                  </span>
                                ) : (
                                  <span>
                                    Created: {format(new Date(announcement.created_at), "MMM d, yyyy 'at' h:mm a")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(announcement.id)}
                              disabled={deletingId === announcement.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="website" className="mt-4">
            <WebsiteEventsManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Announcements;
