import { useState, useEffect } from "react";
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
import { GraduationCap, BookOpen, Crown, ArrowRight, RotateCcw } from "lucide-react";
import { Student } from "@/hooks/useStudents";
import { getGroupLabel } from "@/lib/groups";
import { parseDuasStatus, formatDuasStatus, getLevelsForBook } from "@/lib/duasProgress";
import { JUZ_AMMA_SURAHS, getSurahLabel, getJuzAmmaProgressPercent } from "@/lib/juzAmma";
import { CompletionButton } from "./CompletionButton";
import { HafizCompletionButton } from "./HafizCompletionButton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface StudentProgressEditorProps {
  student: Student;
  onSave: (data: Partial<Student>) => Promise<void>;
  isSaving?: boolean;
}

const QAIDAH_LEVELS = Array.from({ length: 13 }, (_, i) => i + 1);
const DUAS_BOOKS = ["Book 1", "Book 2"];
const JUZ_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);
const TAJWEED_LEVELS = Array.from({ length: 7 }, (_, i) => i + 1);

export const StudentProgressEditor = ({
  student,
  onSave,
  isSaving = false,
}: StudentProgressEditorProps) => {
  const group = student.student_group;
  const parsedDuas = parseDuasStatus(student.duas_status);

  // Group A state
  const [qaidahLevel, setQaidahLevel] = useState<string>(
    student.qaidah_level === 13 ? "" : (student.qaidah_level?.toString() || "")
  );
  const [qaidahCompleted, setQaidahCompleted] = useState(student.qaidah_level === 13);
  
  const [duasBook, setDuasBook] = useState<string>(parsedDuas.book || "");
  const [duasLevel, setDuasLevel] = useState<string>(parsedDuas.level?.toString() || "");
  const [duasCompleted, setDuasCompleted] = useState(parsedDuas.completed);

  // Group B state
  const [quranJuz, setQuranJuz] = useState<string>(
    student.quran_juz?.toString() || ""
  );
  const [quranCompleted, setQuranCompleted] = useState(
    student.quran_completed || false
  );
  const [tajweedLevel, setTajweedLevel] = useState<string>(
    student.tajweed_level?.toString() || ""
  );
  const [tajweedCompleted, setTajweedCompleted] = useState(
    student.tajweed_completed || false
  );

  // Group C state
  const juzAmmaSurah = (student as any).juz_amma_surah;
  const juzAmmaCompleted = (student as any).juz_amma_completed || false;
  const isOnJuzAmmaTrack = !juzAmmaCompleted && !student.hifz_sabak;
  
  const [selectedSurah, setSelectedSurah] = useState<string>(
    juzAmmaSurah?.toString() || "78"
  );
  const [hifzSabak, setHifzSabak] = useState<string>(
    student.hifz_sabak?.toString() || "1"
  );
  const [hifzSPara, setHifzSPara] = useState<string>(
    student.hifz_s_para?.toString() || "1"
  );
  const [hifzDaur, setHifzDaur] = useState<string>(
    student.hifz_daur?.toString() || ""
  );
  const [hifzGraduated, setHifzGraduated] = useState(
    student.hifz_graduated || false
  );

  // Track switch confirmation dialogs
  const [showSkipToHifzDialog, setShowSkipToHifzDialog] = useState(false);
  const [showMoveToJuzAmmaDialog, setShowMoveToJuzAmmaDialog] = useState(false);

  // Reset level when book changes
  useEffect(() => {
    if (duasBook !== parsedDuas.book) {
      setDuasLevel("");
    }
  }, [duasBook, parsedDuas.book]);

  const duasLevels = getLevelsForBook(duasBook);

  const handleSaveGroupA = async () => {
    await onSave({
      qaidah_level: qaidahCompleted ? 13 : (qaidahLevel ? parseInt(qaidahLevel) : null),
      duas_status: formatDuasStatus(duasBook, duasLevel ? parseInt(duasLevel) : null, duasCompleted),
    });
  };

  const handleSaveGroupB = async () => {
    await onSave({
      quran_juz: quranCompleted ? 30 : (quranJuz ? parseInt(quranJuz) : null),
      quran_completed: quranCompleted,
      tajweed_level: tajweedCompleted ? 7 : (tajweedLevel ? parseInt(tajweedLevel) : null),
      tajweed_completed: tajweedCompleted,
      duas_status: formatDuasStatus(duasBook, duasLevel ? parseInt(duasLevel) : null, duasCompleted),
    });
  };

  const handleSaveJuzAmma = async () => {
    await onSave({
      juz_amma_surah: parseInt(selectedSurah),
      juz_amma_completed: false,
    } as any);
  };

  const handleSkipToHifz = async () => {
    await onSave({
      juz_amma_completed: true,
      hifz_sabak: 1,
      hifz_s_para: 1,
    } as any);
    setShowSkipToHifzDialog(false);
  };

  const handleMoveToJuzAmma = async () => {
    await onSave({
      juz_amma_surah: juzAmmaSurah || 78,
      juz_amma_completed: false,
      hifz_sabak: null,
      hifz_s_para: null,
      hifz_daur: null,
    } as any);
    setShowMoveToJuzAmmaDialog(false);
  };

  const handleSaveGroupC = async () => {
    await onSave({
      hifz_sabak: hifzSabak ? parseInt(hifzSabak) : null,
      hifz_s_para: hifzSPara ? parseInt(hifzSPara) : null,
      hifz_daur: hifzGraduated ? null : (hifzDaur ? parseInt(hifzDaur) : null),
      hifz_graduated: hifzGraduated,
    });
  };

  const juzAmmaProgress = getJuzAmmaProgressPercent(parseInt(selectedSurah) || null, false);

  if (!group) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <p>No group assigned. Assign a group to track progress.</p>
      </div>
    );
  }

  const renderDuasSection = () => (
    <div className="space-y-3">
      <Label className="text-base font-medium">Duas Progress</Label>
      <div className="flex gap-2">
        <Select 
          value={duasBook} 
          onValueChange={setDuasBook}
          disabled={duasCompleted}
        >
          <SelectTrigger className="flex-1 h-14 text-base">
            <SelectValue placeholder="Select book" />
          </SelectTrigger>
          <SelectContent>
            {DUAS_BOOKS.map((book) => (
              <SelectItem key={book} value={book} className="py-3">
                {book}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select 
          value={duasLevel} 
          onValueChange={setDuasLevel}
          disabled={duasCompleted || !duasBook}
        >
          <SelectTrigger className="w-28 h-14 text-base">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            {duasLevels.map((level) => (
              <SelectItem key={level} value={level.toString()} className="py-3">
                Level {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end">
        <CompletionButton
          label="Duas"
          checked={duasCompleted}
          onCheckedChange={setDuasCompleted}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <BookOpen className="w-5 h-5" />
        <span className="font-semibold">{getGroupLabel(group)} Progress</span>
      </div>

      {group === "A" && (
        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-base font-medium">Qaidah Level (1-13)</Label>
            <Select 
              value={qaidahLevel} 
              onValueChange={setQaidahLevel}
              disabled={qaidahCompleted}
            >
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {QAIDAH_LEVELS.map((level) => (
                  <SelectItem key={level} value={level.toString()} className="py-3">
                    Level {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end">
              <CompletionButton
                label="Qaidah"
                checked={qaidahCompleted}
                onCheckedChange={setQaidahCompleted}
              />
            </div>
          </div>

          {renderDuasSection()}

          <Button
            onClick={handleSaveGroupA}
            disabled={isSaving}
            className="w-full h-14 text-base"
          >
            {isSaving ? "Saving..." : "Save Progress"}
          </Button>
        </div>
      )}

      {group === "B" && (
        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-base font-medium">Quran Juz (1-30)</Label>
            <Select
              value={quranJuz}
              onValueChange={setQuranJuz}
              disabled={quranCompleted}
            >
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Select juz" />
              </SelectTrigger>
              <SelectContent>
                {JUZ_OPTIONS.map((juz) => (
                  <SelectItem key={juz} value={juz.toString()} className="py-3">
                    Juz {juz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end">
              <CompletionButton
                label="Quran"
                checked={quranCompleted}
                onCheckedChange={setQuranCompleted}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Tajweed Level (1-7)</Label>
            <Select
              value={tajweedLevel}
              onValueChange={setTajweedLevel}
              disabled={tajweedCompleted}
            >
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {TAJWEED_LEVELS.map((level) => (
                  <SelectItem key={level} value={level.toString()} className="py-3">
                    Level {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end">
              <CompletionButton
                label="Tajweed"
                checked={tajweedCompleted}
                onCheckedChange={setTajweedCompleted}
              />
            </div>
          </div>

          {renderDuasSection()}

          <Button
            onClick={handleSaveGroupB}
            disabled={isSaving}
            className="w-full h-14 text-base"
          >
            {isSaving ? "Saving..." : "Save Progress"}
          </Button>
        </div>
      )}

      {group === "C" && isOnJuzAmmaTrack && (
        <div className="space-y-5">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <BookOpen className="w-3 h-3 mr-1" />
              Juzʾ ʿAmma Track
            </Badge>
          </div>

          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{juzAmmaProgress}%</span>
            </div>
            <Progress value={juzAmmaProgress} className="h-2" />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Current Surah</Label>
            <Select value={selectedSurah} onValueChange={setSelectedSurah}>
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Select surah" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {JUZ_AMMA_SURAHS.map((surah) => (
                  <SelectItem key={surah.number} value={surah.number.toString()} className="py-3">
                    {getSurahLabel(surah.number)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSaveJuzAmma}
            disabled={isSaving}
            className="w-full h-14 text-base"
          >
            {isSaving ? "Saving..." : "Save Progress"}
          </Button>

          {/* Graduate to full Hifz button */}
          <Button
            variant="default"
            onClick={() => setShowSkipToHifzDialog(true)}
            disabled={isSaving}
            className="w-full h-12 bg-primary/90 hover:bg-primary"
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            Graduate to Full Hifz
          </Button>

          {/* Skip to Hifz confirmation dialog */}
          <AlertDialog open={showSkipToHifzDialog} onOpenChange={setShowSkipToHifzDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Graduate to Full Hifz Track?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark {student.name} as having completed the Juzʾ ʿAmma track and move them to full Hifz tracking. 
                  They will start from Juz 1. This action can be reversed later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSkipToHifz} disabled={isSaving}>
                  {isSaving ? "Graduating..." : "Graduate to Hifz"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {group === "C" && !isOnJuzAmmaTrack && (
        <div className="space-y-5">
          {juzAmmaCompleted && (
            <div className="flex items-center justify-center">
              <Badge variant="outline" className="text-xs">
                ✓ Juzʾ ʿAmma Completed
              </Badge>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-base font-medium">Sabak (Current Lesson)</Label>
            <Select value={hifzSabak} onValueChange={setHifzSabak}>
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Select juz (1-30)" />
              </SelectTrigger>
              <SelectContent>
                {JUZ_OPTIONS.map((juz) => (
                  <SelectItem key={juz} value={juz.toString()} className="py-3">
                    Juz {juz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Sabak Para (Review)</Label>
            <Select value={hifzSPara} onValueChange={setHifzSPara}>
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Select juz (1-30)" />
              </SelectTrigger>
              <SelectContent>
                {JUZ_OPTIONS.map((juz) => (
                  <SelectItem key={juz} value={juz.toString()} className="py-3">
                    Juz {juz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Daur (Revision)</Label>
            <Select
              value={hifzDaur}
              onValueChange={setHifzDaur}
              disabled={hifzGraduated}
            >
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Select juz (1-30)" />
              </SelectTrigger>
              <SelectContent>
                {JUZ_OPTIONS.map((juz) => (
                  <SelectItem key={juz} value={juz.toString()} className="py-3">
                    Juz {juz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <HafizCompletionButton
              checked={hifzGraduated}
              onCheckedChange={setHifzGraduated}
            />
          </div>

          <Button
            onClick={handleSaveGroupC}
            disabled={isSaving}
            className="w-full h-14 text-base"
          >
            {isSaving ? "Saving..." : hifzGraduated ? "Save & Mark as Hafiz" : "Save Progress"}
          </Button>

          {/* Move back to Juz Amma option */}
          <div className="border-t pt-3">
            <Button
              variant="ghost"
              onClick={() => setShowMoveToJuzAmmaDialog(true)}
              disabled={isSaving}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Move back to Juzʾ ʿAmma track
            </Button>
          </div>

          {/* Move to Juz Amma confirmation dialog */}
          <AlertDialog open={showMoveToJuzAmmaDialog} onOpenChange={setShowMoveToJuzAmmaDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Move to Juzʾ ʿAmma Track?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will move {student.name} back to the Juzʾ ʿAmma track. 
                  Their current Hifz progress (Sabak, S-Para, Daur) will be cleared. This action can be reversed later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleMoveToJuzAmma} disabled={isSaving}>
                  {isSaving ? "Moving..." : "Move to Juzʾ ʿAmma"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
};
