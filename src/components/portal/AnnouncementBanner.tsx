import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { portalSupabase as supabase } from "@/integrations/supabase/portalClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Megaphone, ChevronLeft, ChevronRight, X, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Announcement {
  id: string;
  subject: string;
  message: string;
  image_url: string | null;
  sent_at: string | null;
  maktab_filter: string;
}

export function AnnouncementBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageOpen, setImageOpen] = useState(false);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<Announcement | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // First, get the parent's linked students' maktabs
  const { data: parentMaktabs } = useQuery({
    queryKey: ["parent-maktabs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      // First get the linked student IDs for this parent
      const { data: links, error: linksError } = await supabase
        .from("parent_student_links")
        .select("student_id")
        .eq("parent_id", user.id)
        .not("verified_at", "is", null);
      
      if (linksError) throw linksError;
      
      const studentIds = links?.map(l => l.student_id) || [];
      if (studentIds.length === 0) return [];
      
      // Then get maktabs from those students
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("maktab")
        .in("id", studentIds);
      
      if (studentsError) throw studentsError;
      
      // Get unique maktabs (normalized)
      const maktabs = [
        ...new Set(
          (students || [])
            .map((s: any) => (typeof s?.maktab === "string" ? s.maktab.trim().toLowerCase() : null))
            .filter(Boolean)
        ),
      ];
      return maktabs as string[];
    },
  });

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["portal-announcements", parentMaktabs],
    queryFn: async () => {
      // Filter out expired announcements on the homepage banner
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("announcements")
        .select("id, subject, message, image_url, sent_at, maktab_filter, expires_at")
        .eq("status", "sent")
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("sent_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      // Filter announcements based on parent's maktabs (normalized)
      const parentSet = new Set((parentMaktabs || []).map((m) => m.trim().toLowerCase()));
      const filtered = (data || []).filter((announcement: any) => {
        const filter = typeof announcement?.maktab_filter === "string" ? announcement.maktab_filter.trim().toLowerCase() : "";
        if (filter === "all") return true;
        return parentSet.has(filter);
      });
      
      return filtered as Announcement[];
    },
    enabled: !!parentMaktabs,
  });

  const goNext = useCallback(() => {
    if (announcements && announcements.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }
  }, [announcements]);

  const goPrev = useCallback(() => {
    if (announcements && announcements.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
    }
  }, [announcements]);

  // Auto-scroll every 20 seconds
  useEffect(() => {
    if (!announcements || announcements.length <= 1 || isPaused || imageOpen) {
      return;
    }

    const interval = setInterval(() => {
      goNext();
    }, 20000);

    return () => clearInterval(interval);
  }, [announcements, isPaused, imageOpen, goNext]);

  // Reset index if announcements change
  useEffect(() => {
    if (announcements && currentIndex >= announcements.length) {
      setCurrentIndex(0);
    }
  }, [announcements, currentIndex]);

  if (isLoading || !announcements || announcements.length === 0) {
    return null;
  }

  const current = announcements[currentIndex];
  const hasMultiple = announcements.length > 1;

  const handleImageClick = (announcement: Announcement) => {
    if (announcement.image_url) {
      setExpandedAnnouncement(announcement);
      setImageOpen(true);
    }
  };

  return (
    <>
      <Card 
        className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-primary/20 overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 flex gap-3 sm:gap-4">
              {/* Text content - takes more space */}
              <div className="flex-1 min-w-0 max-w-full">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">
                    Announcement
                  </Badge>
                  {current.maktab_filter === "boys" && (
                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-300">
                      Boys Only
                    </Badge>
                  )}
                  {current.maktab_filter === "girls" && (
                    <Badge variant="outline" className="text-xs bg-pink-500/10 text-pink-600 border-pink-300">
                      Girls Only
                    </Badge>
                  )}
                  {current.sent_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(current.sent_at), "dd MMM yyyy")}
                    </span>
                  )}
                </div>
                
                <h3 className="font-semibold text-foreground truncate">{current.subject}</h3>
                <p className="text-sm text-muted-foreground line-clamp-6 mt-1 whitespace-pre-wrap">
                  {current.message}
                </p>

                {/* Carousel dots */}
                {hasMultiple && (
                  <div className="flex items-center gap-1.5 mt-3">
                    {announcements.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          idx === currentIndex 
                            ? "w-4 bg-primary" 
                            : "w-1.5 bg-primary/30 hover:bg-primary/50"
                        )}
                        aria-label={`Go to announcement ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Image on the right - fixed smaller width */}
              {current.image_url && (
                <div 
                  className="relative cursor-pointer group overflow-hidden rounded-xl border-2 border-primary/30 shadow-md bg-muted/50 flex-shrink-0 w-28 h-36 sm:w-36 sm:h-44"
                  onClick={() => handleImageClick(current)}
                >
                  <img 
                    src={current.image_url} 
                    alt="Announcement" 
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 py-2 flex justify-center">
                    <span className="text-xs text-white font-semibold flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Tap to enlarge
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Navigation arrows */}
            {hasMultiple && (
              <div className="flex flex-col gap-1 flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={goPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-center text-muted-foreground">
                  {currentIndex + 1}/{announcements.length}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={goNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Image enlargement dialog */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-0" hideCloseButton>
          <DialogTitle className="sr-only">
            {expandedAnnouncement?.subject || "Announcement Image"}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
            onClick={() => setImageOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>
          {expandedAnnouncement?.image_url && (
            <div className="p-4">
              <img 
                src={expandedAnnouncement.image_url} 
                alt="Announcement" 
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
              <div className="mt-4 text-white">
                <h3 className="font-semibold text-lg">{expandedAnnouncement.subject}</h3>
                <p className="text-sm text-white/80 mt-2 whitespace-pre-wrap">
                  {expandedAnnouncement.message}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
