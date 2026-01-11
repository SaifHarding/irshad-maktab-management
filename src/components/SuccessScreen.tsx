import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Star, Sparkles, Trophy } from "lucide-react";
import { triggerHighAttendanceConfetti, triggerPerfectAttendanceConfetti } from "@/lib/confetti";

interface SuccessScreenProps {
  presentCount: number;
  absentCount: number;
  nonHifzPresentCount: number;
  nonHifzAbsentCount: number;
  onStartNew: () => void;
  maktab?: "boys" | "girls";
  groupsLogged?: string[];
}

const SuccessScreen = ({
  presentCount,
  absentCount,
  nonHifzPresentCount,
  nonHifzAbsentCount,
  onStartNew,
  maktab,
  groupsLogged = [],
}: SuccessScreenProps) => {
  const totalStudents = presentCount + absentCount;
  const attendancePercentage = totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0;
  
  // Use non-Hifz counts for gold day calculation (Hifz students are treated separately)
  const nonHifzTotal = nonHifzPresentCount + nonHifzAbsentCount;
  const nonHifzPercentage = nonHifzTotal > 0 ? (nonHifzPresentCount / nonHifzTotal) * 100 : 0;
  
  // For girls maktab, only show 100% celebration if groups A and B were logged (not C)
  const allGroupsCovered = maktab === "girls" 
    ? ["A", "B"].every(g => groupsLogged.includes(g))
    : true;
  
  // Use non-Hifz percentage for gold day celebration
  const isPerfectAttendance = nonHifzPercentage === 100 && allGroupsCovered && nonHifzTotal > 0;
  const isHighAttendance = nonHifzPercentage >= 90 && nonHifzTotal > 0;

  useEffect(() => {
    if (isPerfectAttendance) {
      const timer = setTimeout(() => {
        triggerPerfectAttendanceConfetti();
      }, 300);
      return () => clearTimeout(timer);
    } else if (isHighAttendance) {
      const timer = setTimeout(() => {
        triggerHighAttendanceConfetti();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isPerfectAttendance, isHighAttendance]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 safe-top safe-bottom relative overflow-hidden">
      <Card className="w-full">
        <CardContent className="pt-8 space-y-8 text-center">
          <div className="flex justify-center">
            {isPerfectAttendance ? (
              <div className="relative">
                <Trophy className="w-28 h-28 text-yellow-500 fill-yellow-500 animate-scale-in" />
                <Star className="absolute -top-2 -right-2 w-10 h-10 text-yellow-400 fill-yellow-400 animate-pulse" />
                <Star className="absolute -top-1 -left-3 w-8 h-8 text-yellow-500 fill-yellow-500 animate-pulse" style={{ animationDelay: "0.2s" }} />
                <Sparkles className="absolute bottom-0 -right-4 w-8 h-8 text-yellow-400 animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
            ) : isHighAttendance ? (
              <div className="relative">
                <CheckCircle className="w-28 h-28 text-green-600 animate-scale-in" />
                <Star className="absolute -top-2 -right-2 w-10 h-10 text-yellow-500 fill-yellow-500 animate-pulse" />
                <Sparkles className="absolute -top-1 -left-2 w-8 h-8 text-yellow-400 animate-pulse" />
              </div>
            ) : (
              <CheckCircle className="w-28 h-28 text-green-600" />
            )}
          </div>
          
          <div className="space-y-3">
            <h2 className="text-5xl font-bold text-foreground">
              {isPerfectAttendance ? "Perfect!" : isHighAttendance ? "Amazing!" : "Attendance Saved!"}
            </h2>
            <p className="text-muted-foreground text-xl">
              {isPerfectAttendance
                ? "100% attendance - Everyone showed up!"
                : isHighAttendance 
                  ? `${Math.round(nonHifzPercentage)}% attendance today!`
                  : `Successfully recorded attendance for ${totalStudents} student${totalStudents !== 1 ? "s" : ""}`
              }
            </p>
            {isPerfectAttendance && (
              <p className="text-yellow-600 font-medium text-lg animate-fade-in">
                🏆 Outstanding! Full class attendance! 🏆
              </p>
            )}
            {isHighAttendance && !isPerfectAttendance && (
              <p className="text-green-600 font-medium text-lg animate-fade-in">
                🎉 Great job keeping attendance high! 🎉
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 py-6">
            <div className="space-y-2">
              <p className="text-5xl font-bold text-green-600">{presentCount}</p>
              <p className="text-lg text-muted-foreground">Present</p>
            </div>
            <div className="space-y-2">
              <p className="text-5xl font-bold text-destructive">{absentCount}</p>
              <p className="text-lg text-muted-foreground">Absent</p>
            </div>
          </div>

          <Button onClick={onStartNew} className="w-full h-20 text-2xl touch-manipulation" size="lg">
            Start New Session
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuccessScreen;