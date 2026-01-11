import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GroupAProgressForm } from "./GroupAProgressForm";
import { GroupBProgressForm } from "./GroupBProgressForm";
import { GroupCProgressForm } from "./GroupCProgressForm";
import { getParentGroup } from "@/lib/groups";

export interface StudentProgress {
  id: string;
  name: string;
  student_group: string | null;
  gender: "boys" | "girls";
  qaidah_level: number | null;
  duas_status: string | null;
  quran_juz: number | null;
  quran_completed: boolean;
  tajweed_level: number | null;
  tajweed_completed: boolean;
  hifz_sabak: number | null;
  hifz_s_para: number | null;
  hifz_daur: number | null;
  hifz_graduated: boolean;
  juz_amma_surah: number | null;
  juz_amma_completed: boolean;
}

interface ProgressPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentProgress | null;
  isFirstPrompt?: boolean;
  onSubmitGroupA: (data: { qaidah_level: number; duas_status: string }) => void;
  onSubmitGroupB: (data: {
    quran_juz: number | null;
    quran_completed: boolean;
    tajweed_level: number | null;
    tajweed_completed: boolean;
    duas_status: string;
  }) => void;
  onSubmitGroupC: (data: {
    hifz_sabak?: number;
    hifz_s_para?: number;
    hifz_daur?: number | null;
    hifz_graduated?: boolean;
    juz_amma_surah?: number | null;
    juz_amma_completed?: boolean;
  }) => void;
  onGraduateAtoB: () => void;
  onGraduateBtoC: () => void;
  onSkip: () => void;
  onSkipClassToday?: () => void;
  isSubmitting?: boolean;
}

export const ProgressPromptDialog = ({
  open,
  onOpenChange,
  student,
  isFirstPrompt = false,
  onSubmitGroupA,
  onSubmitGroupB,
  onSubmitGroupC,
  onGraduateAtoB,
  onGraduateBtoC,
  onSkip,
  onSkipClassToday,
  isSubmitting = false,
}: ProgressPromptDialogProps) => {
  if (!student) return null;

  const renderForm = () => {
    // Use parent group for progress form determination (A1, A2 -> A)
    const parentGroup = getParentGroup(student.student_group);
    
    switch (parentGroup) {
      case "A":
        return (
          <GroupAProgressForm
            studentName={student.name}
            currentQaidahLevel={student.qaidah_level}
            currentDuasStatus={student.duas_status}
            onSubmit={onSubmitGroupA}
            onGraduate={onGraduateAtoB}
            onSkip={onSkip}
            onSkipClassToday={isFirstPrompt ? onSkipClassToday : undefined}
            isSubmitting={isSubmitting}
          />
        );
      case "B":
        return (
          <GroupBProgressForm
            studentName={student.name}
            gender={student.gender}
            currentQuranJuz={student.quran_juz}
            currentQuranCompleted={student.quran_completed}
            currentTajweedLevel={student.tajweed_level}
            currentTajweedCompleted={student.tajweed_completed}
            currentDuasStatus={student.duas_status}
            onSubmit={onSubmitGroupB}
            onGraduate={onGraduateBtoC}
            onSkip={onSkip}
            onSkipClassToday={isFirstPrompt ? onSkipClassToday : undefined}
            isSubmitting={isSubmitting}
          />
        );
      case "C":
        return (
          <GroupCProgressForm
            studentName={student.name}
            currentSabak={student.hifz_sabak}
            currentSPara={student.hifz_s_para}
            currentDaur={student.hifz_daur}
            isGraduated={student.hifz_graduated}
            juzAmmaSurah={student.juz_amma_surah}
            juzAmmaCompleted={student.juz_amma_completed}
            onSubmit={onSubmitGroupC}
            onSkip={onSkip}
            onSkipClassToday={isFirstPrompt ? onSkipClassToday : undefined}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return (
          <div className="text-center py-4 space-y-4">
            <p className="text-muted-foreground">No group assigned to this student.</p>
            <Button onClick={onSkip}>Continue</Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Monthly Progress Update</DialogTitle>
        </DialogHeader>
        {renderForm()}
      </DialogContent>
    </Dialog>
  );
};
