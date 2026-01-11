import { useMemo } from "react";
import { format } from "date-fns";

interface Student {
  id: string;
  name: string;
  student_group?: string | null;
  gender?: string | null;
  last_progress_month?: string | null;
  progress_due_month?: string | null;
  progress_due_since_date?: string | null;
}

interface UseProgressPromptOptions {
  maktab: "boys" | "girls";
  student: Student | null;
}

export const useProgressPrompt = ({ maktab, student }: UseProgressPromptOptions) => {
  const shouldShowPrompt = useMemo(() => {
    if (!student) return false;
    
    const today = new Date();
    const currentMonth = format(today, "yyyy-MM");
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayOfMonth = today.getDate();

    // Check if progress has already been recorded this month
    if (student.last_progress_month === currentMonth) {
      return false;
    }

    // Must have a group assigned
    if (!student.student_group) {
      return false;
    }

    // Special case for December 2024: progress commences on specific dates
    const isDecember2024 = currentMonth === "2024-12";
    if (isDecember2024) {
      if (maktab === "girls") {
        // Girls: Starting 9th Dec, on Tuesday (2) or Wednesday (3)
        if (dayOfMonth < 9) return false;
        if (dayOfWeek !== 2 && dayOfWeek !== 3) return false;
      } else {
        // Boys: Starting 8th Dec, on Monday (1) through Thursday (4)
        if (dayOfMonth < 8) return false;
        if (dayOfWeek < 1 || dayOfWeek > 4) return false;
      }
      return true;
    }

    // Normal rules for other months
    // Girls: Tuesday (2) and Wednesday (3) only
    // Boys: Monday (1) through Thursday (4)
    if (maktab === "girls") {
      if (dayOfWeek !== 2 && dayOfWeek !== 3) {
        return false;
      }
    } else {
      if (dayOfWeek < 1 || dayOfWeek > 4) {
        return false;
      }
    }

    return true;
  }, [maktab, student]);

  const getCurrentMonth = () => format(new Date(), "yyyy-MM");

  return {
    shouldShowPrompt,
    getCurrentMonth,
  };
};
