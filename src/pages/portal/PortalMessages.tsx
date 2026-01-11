import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { portalSupabase as supabase } from "@/integrations/supabase/portalClient";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useParentNotifications } from "@/hooks/useParentData";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, Mail, MailOpen, Clock, Megaphone, ImageIcon, X } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

interface Announcement {
  id: string;
  subject: string;
  message: string;
  image_url: string | null;
  sent_at: string | null;
  maktab_filter: string;
}

export default function PortalMessages() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [expandedImage, setExpandedImage] = useState<Announcement | null>(null);

  const { data: notifications, isLoading: notificationsLoading } = useParentNotifications();

  // First, get the parent's linked students' maktabs
  const { data: parentMaktabs } = useQuery({
    queryKey: ["parent-maktabs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("parent_student_links")
        .select("students!inner(maktab)")
        .eq("parent_id", user.id)
        .not("verified_at", "is", null);
      
      if (error) throw error;
      // Get unique maktabs
      const maktabs = [...new Set(data?.map((link: any) => link.students?.maktab).filter(Boolean))];
      return maktabs as string[];
    },
  });

  // Fetch announcements without expiry filter for messages page
  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ["portal-announcements-all", parentMaktabs],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, subject, message, image_url, sent_at, maktab_filter")
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Filter announcements based on parent's maktabs
      const filtered = (data || []).filter((announcement: any) => {
        if (announcement.maktab_filter === "all") return true;
        return parentMaktabs?.includes(announcement.maktab_filter);
      });
      
      return filtered as Announcement[];
    },
    enabled: !!parentMaktabs,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/portal/auth", { replace: true });
      } else {
        setIsAuthenticated(true);
      }
    });
  }, [navigate]);

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from("parent_notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      queryClient.invalidateQueries({ queryKey: ["parent-notifications"] });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isLoading = notificationsLoading || announcementsLoading;
  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  // Combine and sort all messages by date
  const allMessages = [
    ...(announcements || []).map(a => ({
      id: a.id,
      type: 'announcement' as const,
      title: a.subject,
      message: a.message,
      image_url: a.image_url,
      created_at: a.sent_at,
      is_read: true, // Announcements are always considered "read"
    })),
    ...(notifications || []).map(n => ({
      id: n.id,
      type: 'notification' as const,
      title: n.title,
      message: n.message,
      image_url: null,
      created_at: n.created_at,
      is_read: n.is_read,
      studentName: n.students?.name,
    })),
  ].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <PortalLayout title="Messages">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Messages</h2>
            <p className="text-muted-foreground mt-1">
              Notifications and announcements from the school.
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} unread</Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : allMessages.length > 0 ? (
          <div className="space-y-4">
            {allMessages.map((msg) => (
              <Card 
                key={`${msg.type}-${msg.id}`}
                className={`transition-colors ${
                  !msg.is_read ? "bg-accent/30 border-primary/20 cursor-pointer" : ""
                }`}
                onClick={() => {
                  if (msg.type === 'notification' && !msg.is_read) {
                    markAsRead(msg.id);
                  }
                }}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full flex-shrink-0 ${
                      msg.type === 'announcement' 
                        ? "bg-primary/20" 
                        : msg.is_read ? "bg-muted" : "bg-primary/10"
                    }`}>
                      {msg.type === 'announcement' ? (
                        <Megaphone className="h-4 w-4 text-primary" />
                      ) : msg.is_read ? (
                        <MailOpen className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Mail className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-medium ${
                            !msg.is_read ? "text-foreground" : "text-foreground"
                          }`}>
                            {msg.title}
                          </h3>
                          {msg.type === 'announcement' && (
                            <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">
                              Announcement
                            </Badge>
                          )}
                        </div>
                        {!msg.is_read && (
                          <Badge variant="secondary" className="shrink-0">New</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {msg.message}
                      </p>

                      {/* Display image for announcements */}
                      {msg.image_url && (
                        <div 
                          className="mt-3 relative cursor-pointer group overflow-hidden rounded-lg border border-border w-fit max-w-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedImage({
                              id: msg.id,
                              subject: msg.title,
                              message: msg.message,
                              image_url: msg.image_url,
                              sent_at: msg.created_at,
                              maktab_filter: '',
                            });
                          }}
                        >
                          <img 
                            src={msg.image_url} 
                            alt="Attachment" 
                            className="max-h-48 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1.5 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-white font-medium flex items-center gap-1">
                              <ImageIcon className="h-3 w-3" />
                              Click to enlarge
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {msg.created_at && format(new Date(msg.created_at), "d MMM yyyy, h:mm a")}
                        {msg.type === 'notification' && (msg as any).studentName && (
                          <>
                            <span>•</span>
                            <span>Re: {(msg as any).studentName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No Messages</h3>
                <p className="text-muted-foreground text-sm">
                  You don't have any messages yet. When the school sends you 
                  notifications or announcements, they will appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Image enlargement dialog */}
      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-0" hideCloseButton>
          <DialogTitle className="sr-only">
            {expandedImage?.subject || "Image"}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
            onClick={() => setExpandedImage(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          {expandedImage?.image_url && (
            <div className="p-4">
              <img 
                src={expandedImage.image_url} 
                alt="Attachment" 
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
              <div className="mt-4 text-white">
                <h3 className="font-semibold text-lg">{expandedImage.subject}</h3>
                <p className="text-sm text-white/80 mt-2 whitespace-pre-wrap">
                  {expandedImage.message}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
