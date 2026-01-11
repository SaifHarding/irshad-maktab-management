// Juz' Amma surahs (78-114) in order
export interface Surah {
  number: number;
  name: string;
  arabicName?: string;
}

export const JUZ_AMMA_SURAHS: Surah[] = [
  { number: 78, name: "Al-Nabaʾ" },
  { number: 79, name: "Al-Nāziʿāt" },
  { number: 80, name: "ʿAbasa" },
  { number: 81, name: "At-Takwīr" },
  { number: 82, name: "Al-Infiṭār" },
  { number: 83, name: "Al-Muṭaffifīn" },
  { number: 84, name: "Al-Inshiqāq" },
  { number: 85, name: "Al-Burūj" },
  { number: 86, name: "Aṭ-Ṭāriq" },
  { number: 87, name: "Al-Aʿlā" },
  { number: 88, name: "Al-Ghāshiyah" },
  { number: 89, name: "Al-Fajr" },
  { number: 90, name: "Al-Balad" },
  { number: 91, name: "Ash-Shams" },
  { number: 92, name: "Al-Layl" },
  { number: 93, name: "Aḍ-Ḍuḥā" },
  { number: 94, name: "Ash-Sharḥ" },
  { number: 95, name: "At-Tīn" },
  { number: 96, name: "Al-ʿAlaq" },
  { number: 97, name: "Al-Qadr" },
  { number: 98, name: "Al-Bayyinah" },
  { number: 99, name: "Az-Zalzalah" },
  { number: 100, name: "Al-ʿĀdiyāt" },
  { number: 101, name: "Al-Qāriʿah" },
  { number: 102, name: "At-Takāthur" },
  { number: 103, name: "Al-ʿAṣr" },
  { number: 104, name: "Al-Humazah" },
  { number: 105, name: "Al-Fīl" },
  { number: 106, name: "Quraysh" },
  { number: 107, name: "Al-Māʿūn" },
  { number: 108, name: "Al-Kawthar" },
  { number: 109, name: "Al-Kāfirūn" },
  { number: 110, name: "An-Naṣr" },
  { number: 111, name: "Al-Masad" },
  { number: 112, name: "Al-Ikhlāṣ" },
  { number: 113, name: "Al-Falaq" },
  { number: 114, name: "An-Nās" },
];

export const TOTAL_JUZ_AMMA_SURAHS = JUZ_AMMA_SURAHS.length; // 37 surahs

export function getSurahByNumber(number: number): Surah | undefined {
  return JUZ_AMMA_SURAHS.find(s => s.number === number);
}

export function getSurahLabel(number: number): string {
  const surah = getSurahByNumber(number);
  return surah ? `${surah.number}. ${surah.name}` : `Surah ${number}`;
}

export function getJuzAmmaProgress(currentSurah: number | null): number {
  if (!currentSurah) return 0;
  const index = JUZ_AMMA_SURAHS.findIndex(s => s.number === currentSurah);
  if (index === -1) return 0;
  // Progress is based on completed surahs (current - 1)
  return index;
}

export function getJuzAmmaProgressPercent(currentSurah: number | null, completed: boolean): number {
  if (completed) return 100;
  if (!currentSurah) return 0;
  const completedCount = getJuzAmmaProgress(currentSurah);
  return Math.round((completedCount / TOTAL_JUZ_AMMA_SURAHS) * 100);
}

export function isOnJuzAmmaTrack(student: {
  student_group?: string | null;
  juz_amma_completed?: boolean | null;
  hifz_sabak?: number | null;
}): boolean {
  // Student is on Juz Amma track if they're in Group C and haven't completed Juz Amma
  // and don't have any hifz progress yet
  return (
    student.student_group === "C" &&
    !student.juz_amma_completed &&
    !student.hifz_sabak
  );
}
