import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GraduationCap } from "lucide-react";
import { parseDuasStatus, formatDuasStatus, getLevelsForBook } from "@/lib/duasProgress";
import { CompletionButton } from "./CompletionButton";

interface GroupBProgressFormProps {
  studentName: string;
  gender: "boys" | "girls";
  currentQuranJuz: number | null;
  currentQuranCompleted: boolean;
  currentTajweedLevel: number | null;
  currentTajweedCompleted: boolean;
  currentDuasStatus: string | null;
  onSubmit: (data: {
    quran_juz: number | null;
    quran_completed: boolean;
    tajweed_level: number | null;
    tajweed_completed: boolean;
    duas_status: string;
    duas_completed: boolean;
  }) => void;
  onGraduate: () => void;
  onSkip: () => void;
  onSkipClassToday?: () => void;
  isSubmitting?: boolean;
}

const QURAN_JUZ = Array.from({ length: 30 }, (_, i) => i + 1);
const TAJWEED_LEVELS = Array.from({ length: 7 }, (_, i) => i + 1);
const DUAS_BOOKS = ["Book 1", "Book 2"];

export const GroupBProgressForm = ({
  studentName,
  gender,
  currentQuranJuz,
  currentQuranCompleted,
  currentTajweedLevel,
  currentTajweedCompleted,
  currentDuasStatus,
  onSubmit,
  onGraduate,
  onSkip,
  onSkipClassToday,
  isSubmitting = false,
}: GroupBProgressFormProps) => {
  const parsedDuas = parseDuasStatus(currentDuasStatus);

  const [quranJuz, setQuranJuz] = useState<string>(
    currentQuranJuz?.toString() || ""
  );
  const [quranCompleted, setQuranCompleted] = useState(currentQuranCompleted || false);
  const [tajweedLevel, setTajweedLevel] = useState<string>(
    currentTajweedLevel?.toString() || ""
  );
  const [tajweedCompleted, setTajweedCompleted] = useState(currentTajweedCompleted || false);
  
  const [duasBook, setDuasBook] = useState<string>(parsedDuas.book || "");
  const [duasLevel, setDuasLevel] = useState<string>(parsedDuas.level?.toString() || "");
  const [duasCompleted, setDuasCompleted] = useState(parsedDuas.completed);

  // Reset level when book changes
  useEffect(() => {
    if (duasBook !== parsedDuas.book) {
      setDuasLevel("");
    }
  }, [duasBook, parsedDuas.book]);

  const handleSubmit = () => {
    if ((duasCompleted || (duasBook && duasLevel)) && (quranCompleted || quranJuz) && (tajweedCompleted || tajweedLevel)) {
      onSubmit({
        quran_juz: quranCompleted ? null : parseInt(quranJuz),
        quran_completed: quranCompleted,
        tajweed_level: tajweedCompleted ? null : parseInt(tajweedLevel),
        tajweed_completed: tajweedCompleted,
        duas_status: formatDuasStatus(duasBook, duasLevel ? parseInt(duasLevel) : null, duasCompleted),
        duas_completed: duasCompleted,
      });
    }
  };

  // Boys can graduate to Hifz (Group C) when Quran and Tajweed are completed
  const canGraduateToHifz = gender === "boys" && quranCompleted && tajweedCompleted;
  const duasLevels = getLevelsForBook(duasBook);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="font-semibold text-lg">{studentName}</h3>
        <p className="text-sm text-muted-foreground">Group B (Quran) Progress</p>
      </div>

      <div className="space-y-4">
        {/* Quran Juz */}
        <div className="space-y-2">
          <Label htmlFor="quran-juz">Quran Juz (1-30)</Label>
          <div className="flex items-center gap-3">
            <Select 
              value={quranJuz} 
              onValueChange={setQuranJuz}
              disabled={quranCompleted}
            >
              <SelectTrigger id="quran-juz" className="flex-1">
                <SelectValue placeholder="Select juz" />
              </SelectTrigger>
              <SelectContent>
                {QURAN_JUZ.map((juz) => (
                  <SelectItem key={juz} value={juz.toString()}>
                    Juz {juz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CompletionButton
              label="Quran"
              checked={quranCompleted}
              onCheckedChange={setQuranCompleted}
            />
          </div>
        </div>

        {/* Tajweed Level */}
        <div className="space-y-2">
          <Label htmlFor="tajweed-level">Tajweed Level (1-7)</Label>
          <div className="flex items-center gap-3">
            <Select 
              value={tajweedLevel} 
              onValueChange={setTajweedLevel}
              disabled={tajweedCompleted}
            >
              <SelectTrigger id="tajweed-level" className="flex-1">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {TAJWEED_LEVELS.map((level) => (
                  <SelectItem key={level} value={level.toString()}>
                    Level {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CompletionButton
              label="Tajweed"
              checked={tajweedCompleted}
              onCheckedChange={setTajweedCompleted}
            />
          </div>
        </div>

        {/* Duas Status */}
        <div className="space-y-2">
          <Label>Duas Progress</Label>
          <div className="flex items-center gap-3">
            <div className="flex-1 flex gap-2">
              <Select 
                value={duasBook} 
                onValueChange={setDuasBook}
                disabled={duasCompleted}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Book" />
                </SelectTrigger>
                <SelectContent>
                  {DUAS_BOOKS.map((book) => (
                    <SelectItem key={book} value={book}>
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
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  {duasLevels.map((level) => (
                    <SelectItem key={level} value={level.toString()}>
                      Level {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CompletionButton
              label="Duas"
              checked={duasCompleted}
              onCheckedChange={setDuasCompleted}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          onClick={handleSubmit}
          disabled={(!duasCompleted && (!duasBook || !duasLevel)) || (!quranCompleted && !quranJuz) || (!tajweedCompleted && !tajweedLevel) || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Saving..." : "Save Progress"}
        </Button>

        {canGraduateToHifz && (
          <Button
            variant="outline"
            onClick={onGraduate}
            disabled={isSubmitting}
            className="w-full border-green-500 text-green-600 hover:bg-green-50"
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            Graduate to Hifz (Group C)
          </Button>
        )}

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
      </div>
    </div>
  );
};
