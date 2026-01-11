import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  Globe, 
  Edit, 
  Trash2, 
  X, 
  Save, 
  ArrowUp, 
  ArrowDown,
  Eye,
  EyeOff,
  Calendar,
  ExternalLink,
  Image as ImageIcon,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WebsiteEvent {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  event_date: string | null;
  event_end_date: string | null;
  is_published: boolean;
  display_order: number;
  expires_at: string | null;
  created_at: string;
  created_by_name: string;
}

const WebsiteEventsManager = () => {
  const [events, setEvents] = useState<WebsiteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [publishImmediately, setPublishImmediately] = useState(true);
  
  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<WebsiteEvent | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("website_events")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching events:", error);
      toast({ title: "Failed to load events", variant: "destructive" });
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setTitle("");
    setDescription("");
    setEventDate("");
    setEventEndDate("");
    setHasExpiry(false);
    setExpiryDate("");
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    setPublishImmediately(true);
  };

  const startEditing = (event: WebsiteEvent) => {
    setIsEditing(true);
    setEditingId(event.id);
    setTitle(event.title);
    setDescription(event.description || "");
    setEventDate(event.event_date || "");
    setEventEndDate(event.event_end_date || "");
    setHasExpiry(!!event.expires_at);
    setExpiryDate(event.expires_at ? event.expires_at.split("T")[0] : "");
    setExistingImageUrl(event.image_url);
    setImagePreview(event.image_url);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" });
      return;
    }

    setSaving(true);
    let imageUrl = existingImageUrl;

    try {
      // Upload new image if present
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("announcement-attachments")
          .upload(fileName, imageFile);

        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
          .from("announcement-attachments")
          .getPublicUrl(fileName);

        imageUrl = publicUrlData.publicUrl;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      const eventData = {
        title: title.trim(),
        description: description.trim() || null,
        image_url: imageUrl,
        event_date: eventDate || null,
        event_end_date: eventEndDate || null,
        expires_at: hasExpiry && expiryDate ? new Date(`${expiryDate}T23:59:59`).toISOString() : null,
      };

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from("website_events")
          .update(eventData)
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Event updated" });
      } else {
        // Create new
        const maxOrder = events.length > 0 ? Math.max(...events.map(e => e.display_order)) : 0;
        const { error } = await supabase
          .from("website_events")
          .insert({
            ...eventData,
            display_order: maxOrder + 1,
            is_published: publishImmediately,
            created_by: user?.id,
            created_by_name: profile?.full_name || "Unknown",
          });

        if (error) throw error;
        toast({ title: publishImmediately ? "Event created and published" : "Event created (draft)" });
      }

      resetForm();
      fetchEvents();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Failed to save event", description: errorMessage, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (event: WebsiteEvent) => {
    const { error } = await supabase
      .from("website_events")
      .update({ is_published: !event.is_published })
      .eq("id", event.id);

    if (error) {
      toast({ title: "Failed to update", variant: "destructive" });
    } else {
      toast({ title: event.is_published ? "Event unpublished" : "Event published" });
      fetchEvents();
    }
  };

  const moveEvent = async (event: WebsiteEvent, direction: "up" | "down") => {
    const currentIndex = events.findIndex(e => e.id === event.id);
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    
    if (swapIndex < 0 || swapIndex >= events.length) return;

    const otherEvent = events[swapIndex];
    
    // Swap display orders
    await Promise.all([
      supabase.from("website_events").update({ display_order: otherEvent.display_order }).eq("id", event.id),
      supabase.from("website_events").update({ display_order: event.display_order }).eq("id", otherEvent.id),
    ]);

    fetchEvents();
  };

  const confirmDelete = async () => {
    if (!deletingEvent) return;

    const { error } = await supabase
      .from("website_events")
      .delete()
      .eq("id", deletingEvent.id);

    if (error) {
      toast({ title: "Failed to delete", variant: "destructive" });
    } else {
      toast({ title: "Event deleted" });
      fetchEvents();
    }

    setDeleteDialogOpen(false);
    setDeletingEvent(null);
  };

  const today = new Date().toISOString().split("T")[0];
  const apiUrl = `https://kqezxvivoddnqmylsuwd.supabase.co/functions/v1/get-public-events`;

  return (
    <div className="space-y-4">
      {/* API Info */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium">Public API Endpoint</p>
              <code className="text-xs bg-background px-2 py-1 rounded border break-all">{apiUrl}</code>
              <p className="text-muted-foreground text-xs">
                Your website can fetch events from this URL. Only published, non-expired events are returned.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Form */}
      {isEditing ? (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{editingId ? "Edit Event" : "Add New Event"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Title *</Label>
              <Input
                id="event-title"
                placeholder="Event title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description">Description (optional)</Label>
              <Textarea
                id="event-description"
                placeholder="Event details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-date">Event Date (optional)</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end-date">End Date (optional)</Label>
                <Input
                  id="event-end-date"
                  type="date"
                  value={eventEndDate}
                  onChange={(e) => setEventEndDate(e.target.value)}
                  min={eventDate}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Event Image/Poster</Label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="max-w-full max-h-48 rounded-lg border" />
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
                <Input type="file" accept="image/*" onChange={handleImageChange} className="cursor-pointer" />
              )}
              <p className="text-xs text-muted-foreground">Max file size: 5MB</p>
            </div>

            {/* Expiry toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="event-expiry-toggle" className="cursor-pointer text-sm">Auto-hide after date</Label>
                </div>
              </div>
              <Switch id="event-expiry-toggle" checked={hasExpiry} onCheckedChange={setHasExpiry} />
            </div>

            {hasExpiry && (
              <div className="space-y-2">
                <Label htmlFor="event-expiry-date">Expiry Date</Label>
                <Input
                  id="event-expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={today}
                />
              </div>
            )}

            {/* Publish immediately toggle - only for new events */}
            {!editingId && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-green-50 dark:bg-green-950/30">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <div>
                    <Label htmlFor="publish-toggle" className="cursor-pointer text-sm">Publish immediately</Label>
                    <p className="text-xs text-muted-foreground">Event will be visible on website right away</p>
                  </div>
                </div>
                <Switch id="publish-toggle" checked={publishImmediately} onCheckedChange={setPublishImmediately} />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving || !title.trim()} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Event"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setIsEditing(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add New Event
        </Button>
      )}

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Website Events
          </CardTitle>
          <CardDescription>
            Manage events displayed on your public website carousel
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No events yet. Add your first event above.
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {events.map((event, index) => {
                  const isExpired = event.expires_at && new Date(event.expires_at) < new Date();
                  
                    return (
                      <div
                        key={event.id}
                        className={`p-4 rounded-lg border bg-card transition-colors ${isExpired ? "opacity-60" : ""}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          {/* Top row: Thumbnail + Content */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Thumbnail */}
                            <div className="w-16 h-16 rounded bg-muted flex-shrink-0 overflow-hidden">
                              {event.image_url ? (
                                <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge variant={event.is_published ? "default" : "secondary"}>
                                  {event.is_published ? (
                                    <><Eye className="h-3 w-3 mr-1" />Published</>
                                  ) : (
                                    <><EyeOff className="h-3 w-3 mr-1" />Draft</>
                                  )}
                                </Badge>
                                {event.event_date && (
                                  <Badge variant="outline">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {format(new Date(event.event_date), "MMM d, yyyy")}
                                    {event.event_end_date && ` - ${format(new Date(event.event_end_date), "MMM d")}`}
                                  </Badge>
                                )}
                                {isExpired && (
                                  <Badge variant="outline" className="text-muted-foreground">Expired</Badge>
                                )}
                              </div>
                              <h4 className="font-semibold truncate">{event.title}</h4>
                              {event.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{event.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">Order: {event.display_order}</p>
                            </div>
                          </div>

                          {/* Actions - horizontal on mobile, vertical on desktop */}
                          <div className="flex sm:flex-col gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 mt-2 sm:mt-0">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 sm:h-7 sm:w-7"
                                onClick={() => moveEvent(event, "up")}
                                disabled={index === 0}
                                title="Move up"
                              >
                                <ArrowUp className="h-4 w-4 sm:h-3 sm:w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 sm:h-7 sm:w-7"
                                onClick={() => moveEvent(event, "down")}
                                disabled={index === events.length - 1}
                                title="Move down"
                              >
                                <ArrowDown className="h-4 w-4 sm:h-3 sm:w-3" />
                              </Button>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 sm:h-7 sm:w-7"
                                onClick={() => togglePublish(event)}
                                title={event.is_published ? "Unpublish" : "Publish"}
                              >
                                {event.is_published ? <EyeOff className="h-4 w-4 sm:h-3 sm:w-3" /> : <Eye className="h-4 w-4 sm:h-3 sm:w-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 sm:h-7 sm:w-7"
                                onClick={() => startEditing(event)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4 sm:h-3 sm:w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 sm:h-7 sm:w-7 text-destructive hover:text-destructive"
                                onClick={() => { setDeletingEvent(event); setDeleteDialogOpen(true); }}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingEvent?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WebsiteEventsManager;
