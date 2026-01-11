import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { portalSupabase as supabase } from "@/integrations/supabase/portalClient";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLinkedStudents } from "@/hooks/useParentData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, BookOpen, Award, CheckCircle, History, Calendar } from "lucide-react";
import { parseDuasStatus, getMaxLevel } from "@/lib/duasProgress";
import { format } from "date-fns";
import { JUZ_AMMA_SURAHS, getSurahLabel, getJuzAmmaProgressPercent, TOTAL_JUZ_AMMA_SURAHS } from "@/lib/juzAmma";

// Qaidah has 13 levels (1-13)
const QAIDAH_MAX_LEVEL = 13;

// Quran Juz 1-30
const QURAN_MAX_JUZ = 30;

// Tajweed has 12 levels (1-12)
const TAJWEED_MAX_LEVEL = 12;

interface ProgressSnapshot {
  id: string;
  snapshot_month: string;
  qaidah_level: number | null;
  duas_status: string | null;
  quran_juz: number | null;
  quran_completed: boolean | null;
  tajweed_level: number | null;
  tajweed_completed: boolean | null;
  hifz_sabak: number | null;
  hifz_s_para: number | null;
  hifz_daur: number | null;
  hifz_graduated: boolean | null;
  juz_amma_surah: number | null;
  juz_amma_completed: boolean | null;
  student_group: string | null;
  created_at: string;
}

export default function PortalProgress() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const { data: students, isLoading: studentsLoading } = useLinkedStudents();

  // Fetch progress history for selected student
  const { data: progressHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["progress-history", selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const { data, error } = await supabase
        .from("student_progress_snapshots")
        .select("*")
        .eq("student_id", selectedStudentId)
        .order("snapshot_month", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as ProgressSnapshot[];
    },
    enabled: !!selectedStudentId,
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

  // Set student from URL param or default to first student
  useEffect(() => {
    if (students && students.length > 0 && !selectedStudentId) {
      const urlStudentId = searchParams.get("student");
      const validStudent = urlStudentId && students.some(s => s.id === urlStudentId);
      setSelectedStudentId(validStudent ? urlStudentId : students[0].id);
    }
  }, [students, selectedStudentId, searchParams]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const selectedStudent = students?.find(s => s.id === selectedStudentId);
  const group = selectedStudent?.student_group;

  const formatMonthLabel = (month: string) => {
    try {
      const [year, m] = month.split("-");
      return format(new Date(parseInt(year), parseInt(m) - 1), "MMM yyyy");
    } catch {
      return month;
    }
  };

  const renderGroupAProgress = () => {
    if (!selectedStudent) return null;

    // Qaidah: 1-13 levels
    const qaidahLevel = selectedStudent.qaidah_level || 0;
    const qaidahProgress = Math.round((qaidahLevel / QAIDAH_MAX_LEVEL) * 100);
    
    // Duas: parse status using the utility
    const duasStatus = selectedStudent.duas_status || "";
    const duasParsed = parseDuasStatus(duasStatus);
    const duasMaxLevel = getMaxLevel(duasParsed.book);
    const duasProgress = duasParsed.completed 
      ? 100 
      : duasParsed.level && duasMaxLevel 
        ? Math.round((duasParsed.level / duasMaxLevel) * 100) 
        : 0;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Qaidah Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted-foreground">Current Level</span>
                <Badge variant="secondary">
                  {qaidahLevel > 0 ? `Level ${qaidahLevel}` : "Not Started"}
                </Badge>
              </div>
              <Progress value={qaidahProgress} className="h-3 bg-muted/50" />
              <p className="text-sm text-muted-foreground mt-2 text-right">
                {qaidahLevel}/{QAIDAH_MAX_LEVEL} levels • <span className="font-bold text-foreground">{qaidahProgress}%</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Duas Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {duasParsed.completed ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <span className="font-medium text-success">Duas Completed!</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Book</span>
                  <Badge variant="secondary">
                    {duasParsed.book || "Not Started"}
                  </Badge>
                </div>
                {duasParsed.book && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Level</span>
                      <Badge variant="outline">
                        Level {duasParsed.level || 0} / {duasMaxLevel}
                      </Badge>
                    </div>
                    <Progress value={duasProgress} className="h-3 bg-muted/50" />
                    <p className="text-sm text-muted-foreground mt-2 text-right">
                      Level {duasParsed.level || 0}/{duasMaxLevel} • <span className="font-bold text-foreground">{duasProgress}%</span>
                    </p>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderGroupBProgress = () => {
    if (!selectedStudent) return null;

    // Quran: 1-30 Juz
    const quranJuz = selectedStudent.quran_juz || 0;
    const quranCompleted = selectedStudent.quran_completed || false;
    const quranProgress = quranCompleted ? 100 : Math.round((quranJuz / QURAN_MAX_JUZ) * 100);
    
    // Tajweed: 1-12 levels
    const tajweedLevel = selectedStudent.tajweed_level || 0;
    const tajweedCompleted = selectedStudent.tajweed_completed || false;
    const tajweedProgress = tajweedCompleted ? 100 : Math.round((tajweedLevel / TAJWEED_MAX_LEVEL) * 100);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Quran Reading Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted-foreground">Current Juz</span>
                <div className="flex items-center gap-2">
                  {quranCompleted && <CheckCircle className="h-4 w-4 text-success" />}
                  <Badge variant={quranCompleted ? "default" : "secondary"}>
                    {quranCompleted ? "Complete" : `Juz ${quranJuz}`}
                  </Badge>
                </div>
              </div>
              <Progress value={quranProgress} className="h-3 bg-muted/50" />
              <p className="text-sm text-muted-foreground mt-2 text-right">
                {quranJuz}/{QURAN_MAX_JUZ} Juz • <span className="font-bold text-foreground">{quranProgress}%</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Tajweed Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted-foreground">Current Level</span>
                <div className="flex items-center gap-2">
                  {tajweedCompleted && <CheckCircle className="h-4 w-4 text-success" />}
                  <Badge variant={tajweedCompleted ? "default" : "secondary"}>
                    {tajweedCompleted ? "Complete" : tajweedLevel > 0 ? `Level ${tajweedLevel}` : "Not Started"}
                  </Badge>
                </div>
              </div>
              <Progress value={tajweedProgress} className="h-3 bg-muted/50" />
              <p className="text-sm text-muted-foreground mt-2 text-right">
                {tajweedLevel}/{TAJWEED_MAX_LEVEL} levels • <span className="font-bold text-foreground">{tajweedProgress}%</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderGroupCProgress = () => {
    if (!selectedStudent) return null;

    // Check if on Juz Amma track
    const juzAmmaSurah = selectedStudent.juz_amma_surah;
    const juzAmmaCompleted = selectedStudent.juz_amma_completed || false;
    const isOnJuzAmmaTrack = !juzAmmaCompleted && !selectedStudent.hifz_sabak;

    const hifzSabak = selectedStudent.hifz_sabak || 0;
    const hifzSPara = selectedStudent.hifz_s_para || 0;
    const hifzDaur = selectedStudent.hifz_daur || 0;
    const hifzGraduated = selectedStudent.hifz_graduated || false;
    const hifzProgress = Math.round((hifzSabak / 30) * 100);

    // Juz Amma progress
    const juzAmmaProgress = getJuzAmmaProgressPercent(juzAmmaSurah, juzAmmaCompleted);
    const currentSurahLabel = juzAmmaSurah ? getSurahLabel(juzAmmaSurah) : "Not Started";

    return (
      <div className="space-y-6">
        {hifzGraduated && (
          <Card className="bg-success/10 border-success/20">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-3">
                <Award className="h-8 w-8 text-success" />
                <div>
                  <h3 className="font-bold text-lg text-success">Hafiz Complete!</h3>
                  <p className="text-sm text-muted-foreground">Congratulations on completing Hifz</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Juz Amma Track */}
        {isOnJuzAmmaTrack && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Juzʾ ʿAmma Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Current Surah</span>
                  <Badge variant="secondary">{currentSurahLabel}</Badge>
                </div>
                <Progress value={juzAmmaProgress} className="h-3 bg-muted/50" />
                <p className="text-sm text-muted-foreground mt-2 text-right">
                  {juzAmmaSurah ? JUZ_AMMA_SURAHS.findIndex(s => s.number === juzAmmaSurah) : 0}/{TOTAL_JUZ_AMMA_SURAHS} surahs • <span className="font-bold text-foreground">{juzAmmaProgress}%</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Students memorize Juzʾ ʿAmma (Surah 78-114) before progressing to full Hifz.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Juz Amma Completed Badge */}
        {juzAmmaCompleted && !isOnJuzAmmaTrack && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Juzʾ ʿAmma Completed
            </Badge>
          </div>
        )}

        {/* Full Hifz Progress - only show if not on Juz Amma track */}
        {!isOnJuzAmmaTrack && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Hifz Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Sabak (New Lesson)</span>
                  <Badge variant="secondary">Juz {hifzSabak}</Badge>
                </div>
                <Progress value={hifzProgress} className="h-3 bg-muted/50" />
                <p className="text-sm text-muted-foreground mt-2 text-right">
                  {hifzSabak}/30 Juz • <span className="font-bold text-foreground">{hifzProgress}%</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-primary">Juz {hifzSPara}</p>
                  <p className="text-xs text-muted-foreground">Sabak Para (Revision)</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-primary">Juz {hifzDaur}</p>
                  <p className="text-xs text-muted-foreground">Daur (Old Revision)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderProgressHistory = () => {
    if (!group || !progressHistory || progressHistory.length === 0) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Progress History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {progressHistory.map((snapshot) => (
              <div
                key={snapshot.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {formatMonthLabel(snapshot.snapshot_month)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {group === "A" && (
                    <>
                      {snapshot.qaidah_level !== null && (
                        <Badge variant="outline" className="text-xs">
                          Qaidah: Level {snapshot.qaidah_level}
                        </Badge>
                      )}
                      {snapshot.duas_status && (
                        <Badge variant="outline" className="text-xs">
                          Duas: {snapshot.duas_status}
                        </Badge>
                      )}
                    </>
                  )}
                  {group === "B" && (
                    <>
                      {snapshot.quran_juz !== null && (
                        <Badge variant="outline" className="text-xs">
                          {snapshot.quran_completed ? "Quran Complete" : `Quran: Juz ${snapshot.quran_juz}`}
                        </Badge>
                      )}
                      {snapshot.tajweed_level !== null && (
                        <Badge variant="outline" className="text-xs">
                          {snapshot.tajweed_completed ? "Tajweed Complete" : `Tajweed: Level ${snapshot.tajweed_level}`}
                        </Badge>
                      )}
                    </>
                  )}
                  {group === "C" && (
                    <>
                      {/* Juz Amma track - show if student has juz_amma_surah OR if they have no hifz progress */}
                      {snapshot.juz_amma_surah !== null && !snapshot.juz_amma_completed ? (
                        <Badge variant="outline" className="text-xs bg-primary/10">
                          Juzʾ ʿAmma: {getSurahLabel(snapshot.juz_amma_surah)}
                        </Badge>
                      ) : snapshot.juz_amma_completed ? (
                        <Badge variant="outline" className="text-xs bg-success/10 text-success">
                          ✓ Juzʾ ʿAmma Complete
                        </Badge>
                      ) : null}
                      
                      {/* Full Hifz track - only show if actually on Hifz (has sabak AND either completed juz amma or no juz amma data) */}
                      {snapshot.hifz_sabak !== null && (snapshot.juz_amma_completed || snapshot.juz_amma_surah === null) && (
                        <>
                          {snapshot.hifz_graduated ? (
                            <Badge variant="outline" className="text-xs bg-success/10 text-success">
                              🎓 Hafiz Complete
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Sabak: Juz {snapshot.hifz_sabak}
                            </Badge>
                          )}
                        </>
                      )}
                      
                      {/* Show message if no progress data */}
                      {snapshot.juz_amma_surah === null && !snapshot.juz_amma_completed && snapshot.hifz_sabak === null && (
                        <span className="text-xs text-muted-foreground italic">No progress recorded</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderProgress = () => {
    if (!group) {
      return (
        <Card>
          <CardContent className="py-8 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No group assigned yet.</p>
          </CardContent>
        </Card>
      );
    }

    switch (group) {
      case "A":
        return renderGroupAProgress();
      case "B":
        return renderGroupBProgress();
      case "C":
        return renderGroupCProgress();
      default:
        return (
          <Card>
            <CardContent className="py-8 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Unknown group: {group}</p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <PortalLayout title="Progress">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Academic Progress</h2>
          <p className="text-muted-foreground mt-1">
            Track your child's learning journey.
          </p>
        </div>

        {/* Student Selector */}
        {students && students.length > 1 && (
          <Select value={selectedStudentId || ""} onValueChange={setSelectedStudentId}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {students.map(student => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Student Info */}
        {selectedStudent && (
          <div className="flex items-center gap-3">
            <Badge variant="outline">{selectedStudent.student_code}</Badge>
            <Badge variant="secondary">Group {selectedStudent.student_group || "—"}</Badge>
            <Badge className="capitalize">{selectedStudent.maktab} Maktab</Badge>
          </div>
        )}

        {/* Progress Content */}
        {studentsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {renderProgress()}
            
            {/* Progress History */}
            {historyLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              renderProgressHistory()
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}
