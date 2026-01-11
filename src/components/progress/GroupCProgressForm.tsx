import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { GraduationCap, BookOpen, ArrowRight, RotateCcw } from "lucide-react";
import { JUZ_AMMA_SURAHS, getSurahLabel, getJuzAmmaProgressPercent } from "@/lib/juzAmma";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface GroupCProgressFormProps {
  studentName: string;
  currentSabak: number | null;
  currentSPara: number | null;
  currentDaur: number | null;
  isGraduated: boolean;
  // Juz Amma fields
  juzAmmaSurah?: number | null;
  juzAmmaCompleted?: boolean;
  onSubmit: (data: {
    hifz_sabak?: number;
    hifz_s_para?: number;
    hifz_daur?: number | null;
    hifz_graduated?: boolean;
    juz_amma_surah?: number | null;
    juz_amma_completed?: boolean;
  }) => void;
  onSkip: () => void;
  onSkipClassToday?: () => void;
  isSubmitting?: boolean;
}

const JUZ_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);

export const GroupCProgressForm = ({
  studentName,
  currentSabak,
  currentSPara,
  currentDaur,
  isGraduated,
  juzAmmaSurah,
  juzAmmaCompleted = false,
  onSubmit,
  onSkip,
  onSkipClassToday,
  isSubmitting = false,
}: GroupCProgressFormProps) => {
  // Determine if student is on Juz Amma track
  const defaultIsOnJuzAmmaTrack = !juzAmmaCompleted && !currentSabak;
  
  // Allow manual track switching
  const [manualTrackOverride, setManualTrackOverride] = useState<"juzamma" | "hifz" | null>(null);
  
  const isOnJuzAmmaTrack = manualTrackOverride 
    ? manualTrackOverride === "juzamma" 
    : defaultIsOnJuzAmmaTrack;
  
  // Juz Amma state
  const [selectedSurah, setSelectedSurah] = useState<string>(
    juzAmmaSurah?.toString() || "78"
  );
  const [juzAmmaComplete, setJuzAmmaComplete] = useState(false);

  // Hifz state
  const [sabak, setSabak] = useState<string>(currentSabak?.toString() || "1");
  const [sPara, setSPara] = useState<string>(currentSPara?.toString() || "1");
  const [daur, setDaur] = useState<string>(currentDaur?.toString() || "");
  const [graduated, setGraduated] = useState(isGraduated);

  // Confirmation dialog states
  const [showSkipToHifzDialog, setShowSkipToHifzDialog] = useState(false);
  const [showMoveToJuzAmmaDialog, setShowMoveToJuzAmmaDialog] = useState(false);

  // Handler to skip Juz Amma and go to full Hifz
  const handleSkipToHifz = () => {
    onSubmit({
      juz_amma_completed: true,
      hifz_sabak: 1,
      hifz_s_para: 1,
    });
    setShowSkipToHifzDialog(false);
  };

  // Handler to move back to Juz Amma track
  const handleMoveToJuzAmma = () => {
    onSubmit({
      juz_amma_surah: juzAmmaSurah || 78,
      juz_amma_completed: false,
      hifz_sabak: null,
      hifz_s_para: null,
      hifz_daur: null,
    });
    setShowMoveToJuzAmmaDialog(false);
  };

  const handleJuzAmmaSubmit = () => {
    const surahNum = parseInt(selectedSurah);
    
    if (juzAmmaComplete) {
      // Graduating from Juz Amma to full Hifz
      onSubmit({
        juz_amma_surah: 114,
        juz_amma_completed: true,
        hifz_sabak: 1, // Start Hifz from Juz 1
        hifz_s_para: 1,
      });
    } else {
      onSubmit({
        juz_amma_surah: surahNum,
        juz_amma_completed: false,
      });
    }
  };

  const handleHifzSubmit = () => {
    if (sabak && sPara && (graduated || daur)) {
      onSubmit({
        hifz_sabak: parseInt(sabak),
        hifz_s_para: parseInt(sPara),
        hifz_daur: graduated ? null : parseInt(daur),
        hifz_graduated: graduated,
      });
    }
  };

  const progressPercent = getJuzAmmaProgressPercent(
    parseInt(selectedSurah) || null,
    juzAmmaComplete
  );

  // Render Juz Amma form
  if (isOnJuzAmmaTrack) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="font-semibold text-lg">{studentName}</h3>
          <div className="flex items-center justify-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              <BookOpen className="w-3 h-3 mr-1" />
              Juzʾ ʿAmma Track
            </Badge>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <div className="space-y-4">
          {/* Surah Selection */}
          <div className="space-y-2">
            <Label htmlFor="surah">Current Surah</Label>
            <Select value={selectedSurah} onValueChange={setSelectedSurah}>
              <SelectTrigger id="surah">
                <SelectValue placeholder="Select surah" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {JUZ_AMMA_SURAHS.map((surah) => (
                  <SelectItem key={surah.number} value={surah.number.toString()}>
                    {getSurahLabel(surah.number)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Completion checkbox - only show if on last surah */}
          {parseInt(selectedSurah) === 114 && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="juz-amma-complete"
                checked={juzAmmaComplete}
                onCheckedChange={(checked) => setJuzAmmaComplete(checked === true)}
              />
              <Label htmlFor="juz-amma-complete" className="text-sm cursor-pointer">
                <GraduationCap className="w-4 h-4 inline mr-1" />
                Completed Juzʾ ʿAmma - Graduate to full Hifz
              </Label>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleJuzAmmaSubmit}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : juzAmmaComplete ? (
              <>
                Graduate to Hifz <ArrowRight className="w-4 h-4 ml-2" />
              </>
            ) : "Save Progress"}
          </Button>

          <Button
            variant="outline"
            onClick={onSkip}
            disabled={isSubmitting}
            className="w-full h-12 text-base"
          >
            Skip for now
          </Button>

          {onSkipClassToday && (
            <Button
              variant="ghost"
              onClick={onSkipClassToday}
              disabled={isSubmitting}
              className="w-full text-muted-foreground text-sm"
            >
              Skip progress for entire class today
            </Button>
          )}

          {/* Skip to full Hifz option */}
          <div className="border-t pt-3 mt-2">
            <Button
              variant="ghost"
              onClick={() => setShowSkipToHifzDialog(true)}
              disabled={isSubmitting}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="w-3 h-3 mr-1" />
              Skip Juzʾ ʿAmma → Move to full Hifz
            </Button>
          </div>

          {/* Skip to Hifz confirmation dialog */}
          <AlertDialog open={showSkipToHifzDialog} onOpenChange={setShowSkipToHifzDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Move to Full Hifz Track?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will skip the Juzʾ ʿAmma track and move {studentName} to full Hifz tracking. 
                  They will start from Juz 1. This action can be reversed later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSkipToHifz} disabled={isSubmitting}>
                  {isSubmitting ? "Moving..." : "Move to Hifz"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  // Render standard Hifz form (for students who completed Juz Amma or already have hifz progress)
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="font-semibold text-lg">{studentName}</h3>
        <p className="text-sm text-muted-foreground">Hifz Progress</p>
        {juzAmmaCompleted && (
          <Badge variant="outline" className="mt-1 text-xs">
            ✓ Juzʾ ʿAmma Completed
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {/* Sabak */}
        <div className="space-y-2">
          <Label htmlFor="sabak">Sabak (Current Lesson) - Juz 1-30</Label>
          <Select value={sabak} onValueChange={setSabak}>
            <SelectTrigger id="sabak">
              <SelectValue placeholder="Select juz" />
            </SelectTrigger>
            <SelectContent>
              {JUZ_OPTIONS.map((juz) => (
                <SelectItem key={juz} value={juz.toString()}>
                  Juz {juz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sabak Para */}
        <div className="space-y-2">
          <Label htmlFor="s-para">Sabak Para (Review) - Juz 1-30</Label>
          <Select value={sPara} onValueChange={setSPara}>
            <SelectTrigger id="s-para">
              <SelectValue placeholder="Select juz" />
            </SelectTrigger>
            <SelectContent>
              {JUZ_OPTIONS.map((juz) => (
                <SelectItem key={juz} value={juz.toString()}>
                  Juz {juz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Daur */}
        <div className="space-y-2">
          <Label htmlFor="daur">Daur (Revision) - Juz 1-30</Label>
          <div className="flex items-center gap-3">
            <Select 
              value={daur} 
              onValueChange={setDaur}
              disabled={graduated}
            >
              <SelectTrigger id="daur" className="flex-1">
                <SelectValue placeholder="Select juz" />
              </SelectTrigger>
              <SelectContent>
                {JUZ_OPTIONS.map((juz) => (
                  <SelectItem key={juz} value={juz.toString()}>
                    Juz {juz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox
                id="graduated"
                checked={graduated}
                onCheckedChange={(checked) => setGraduated(checked === true)}
              />
              <Label htmlFor="graduated" className="text-sm whitespace-nowrap">
                <GraduationCap className="w-4 h-4 inline mr-1" />
                Hafiz
              </Label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          onClick={handleHifzSubmit}
          disabled={!sabak || !sPara || (!graduated && !daur) || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Saving..." : graduated ? "Save & Mark as Hafiz" : "Save Progress"}
        </Button>

        <Button
          variant="outline"
          onClick={onSkip}
          disabled={isSubmitting}
          className="w-full h-12 text-base"
        >
          Skip for now
        </Button>

        {onSkipClassToday && (
          <Button
            variant="ghost"
            onClick={onSkipClassToday}
            disabled={isSubmitting}
            className="w-full text-muted-foreground text-sm"
          >
            Skip progress for entire class today
          </Button>
        )}

        {/* Move back to Juz Amma option */}
        <div className="border-t pt-3 mt-2">
          <Button
            variant="ghost"
            onClick={() => setShowMoveToJuzAmmaDialog(true)}
            disabled={isSubmitting}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Move back to Juzʾ ʿAmma track
          </Button>
        </div>

        {/* Move to Juz Amma confirmation dialog */}
        <AlertDialog open={showMoveToJuzAmmaDialog} onOpenChange={setShowMoveToJuzAmmaDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Move to Juzʾ ʿAmma Track?</AlertDialogTitle>
              <AlertDialogDescription>
                This will move {studentName} back to the Juzʾ ʿAmma track. 
                Their current Hifz progress (Sabak, S-Para, Daur) will be cleared. This action can be reversed later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleMoveToJuzAmma} disabled={isSubmitting}>
                {isSubmitting ? "Moving..." : "Move to Juzʾ ʿAmma"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
