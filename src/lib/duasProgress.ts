// Duas Books have levels:
// Book 1: 5 levels
// Book 2: 10 levels

export const DUAS_BOOK_1_LEVELS = Array.from({ length: 5 }, (_, i) => i + 1);
export const DUAS_BOOK_2_LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

export interface DuasProgress {
  book: "Book 1" | "Book 2" | null;
  level: number | null;
  completed: boolean;
}

export function parseDuasStatus(status: string | null): DuasProgress {
  if (!status || status === "Completed") {
    return { book: null, level: null, completed: status === "Completed" };
  }

  // Format: "Book 1 - Level 3" or just "Book 1" (legacy)
  const match = status.match(/^(Book [12])(?:\s*-\s*Level\s*(\d+))?$/);
  if (match) {
    return {
      book: match[1] as "Book 1" | "Book 2",
      level: match[2] ? parseInt(match[2]) : null,
      completed: false,
    };
  }

  return { book: null, level: null, completed: false };
}

export function formatDuasStatus(book: string | null, level: number | null, completed: boolean): string {
  if (completed) return "Completed";
  if (!book) return "";
  if (!level) return book;
  return `${book} - Level ${level}`;
}

export function getMaxLevel(book: string | null): number {
  if (book === "Book 1") return 5;
  if (book === "Book 2") return 10;
  return 0;
}

export function getLevelsForBook(book: string | null): number[] {
  if (book === "Book 1") return DUAS_BOOK_1_LEVELS;
  if (book === "Book 2") return DUAS_BOOK_2_LEVELS;
  return [];
}
