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

interface GroupAProgressFormProps {
  studentName: string;
  currentQaidahLevel: number | null;
  currentDuasStatus: string | null;
  onSubmit: (data: { qaidah_level: number; duas_status: string }) => void;
  onGraduate: () => void;
  onSkip: () => void;
  onSkipClassToday?: () => void;
  isSubmitting?: boolean;
}

const QAIDAH_LEVELS = Array.from({ length: 13 }, (_, i) => i + 1);
const DUAS_BOOKS = ["Book 1", "Book 2"];

export const GroupAProgressForm = ({
  studentName,
  currentQaidahLevel,
  currentDuasStatus,
  onSubmit,
  onGraduate,
  onSkip,
  onSkipClassToday,
  isSubmitting = false,
}: GroupAProgressFormProps) => {
  const parsedDuas = parseDuasStatus(currentDuasStatus);
  
  const [qaidahLevel, setQaidahLevel] = useState<string>(
    currentQaidahLevel === 13 ? "" : (currentQaidahLevel?.toString() || "")
  );
  const [qaidahCompleted, setQaidahCompleted] = useState(currentQaidahLevel === 13);
  
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
    if ((qaidahCompleted || qaidahLevel) && (duasCompleted || (duasBook && duasLevel))) {
      onSubmit({
        qaidah_level: qaidahCompleted ? 13 : parseInt(qaidahLevel),
        duas_status: formatDuasStatus(duasBook, duasLevel ? parseInt(duasLevel) : null, duasCompleted),
      });
    }
  };

  const isComplete = qaidahCompleted && duasCompleted;
  const duasLevels = getLevelsForBook(duasBook);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="font-semibold text-lg">{studentName}</h3>
        <p className="text-sm text-muted-foreground">Group A (Qaidah) Progress</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="qaidah-level">Qaidah Level (1-13)</Label>
          <div className="flex items-center gap-3">
            <Select 
              value={qaidahLevel} 
              onValueChange={setQaidahLevel}
              disabled={qaidahCompleted}
            >
              <SelectTrigger id="qaidah-level" className="flex-1">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {QAIDAH_LEVELS.map((level) => (
                  <SelectItem key={level} value={level.toString()}>
                    Level {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CompletionButton
              label="Qaidah"
              checked={qaidahCompleted}
              onCheckedChange={setQaidahCompleted}
            />
          </div>
        </div>

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
          disabled={(!qaidahCompleted && !qaidahLevel) || (!duasCompleted && (!duasBook || !duasLevel)) || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Saving..." : "Save Progress"}
        </Button>

        {isComplete && (
          <Button
            variant="outline"
            onClick={onGraduate}
            disabled={isSubmitting}
            className="w-full border-green-500 text-green-600 hover:bg-green-50"
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            Graduate to Quran (Group B)
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
