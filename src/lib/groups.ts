// Group definitions for boys maktab with sub-group support

export interface GroupDefinition {
  code: string;
  name: string;
  label: string;
  parentGroup?: string; // For sub-groups like A1, A2
}

export const GROUPS: Record<string, GroupDefinition> = {
  // Main groups (used for girls maktab and as parent references)
  A: { code: 'A', name: 'Group A', label: 'Qaidah' },
  B: { code: 'B', name: 'Group B', label: 'Quran' },
  C: { code: 'C', name: 'Group C', label: 'Hifz' },
  // Sub-groups for boys maktab
  A1: { code: 'A1', name: 'Group A1', label: 'Qaidah', parentGroup: 'A' },
  A2: { code: 'A2', name: 'Group A2', label: 'Qaidah', parentGroup: 'A' },
} as const;

// Group codes for girls maktab (original groups)
export const GIRLS_GROUP_CODES = ['A', 'B', 'C'] as const;

// Group codes for boys maktab (with sub-groups)
export const BOYS_GROUP_CODES = ['A1', 'A2', 'B', 'C'] as const;

// Legacy - all group codes (for backward compatibility)
export const GROUP_CODES = ['A', 'A1', 'A2', 'B', 'C'] as const;

export type GroupCode = keyof typeof GROUPS;

/**
 * Get the parent group code for a sub-group (e.g., A1 -> A)
 * Returns the code itself if it's not a sub-group
 */
export function getParentGroup(code: string | null | undefined): string | null {
  if (!code) return null;
  const group = GROUPS[code];
  return group?.parentGroup || code;
}

/**
 * Get all sub-groups for a parent group code
 */
export function getSubGroups(parentCode: string): string[] {
  return Object.values(GROUPS)
    .filter(g => g.parentGroup === parentCode)
    .map(g => g.code);
}

/**
 * Get available group codes based on maktab
 */
export function getGroupCodesForMaktab(maktab: 'boys' | 'girls' | string | undefined): readonly string[] {
  if (maktab === 'boys') {
    return BOYS_GROUP_CODES;
  }
  return GIRLS_GROUP_CODES;
}

/**
 * Check if a group code is valid for a given maktab
 */
export function isValidGroupForMaktab(code: string | null | undefined, maktab: 'boys' | 'girls' | string | undefined): boolean {
  if (!code) return false;
  const validCodes = getGroupCodesForMaktab(maktab);
  return validCodes.includes(code as any);
}

export function getGroupLabel(code: GroupCode | string | null): string {
  if (!code) return 'Unassigned';
  const group = GROUPS[code as GroupCode];
  return group ? `${group.name} (${group.label})` : 'Unknown';
}

export function getGroupShortLabel(code: GroupCode | string | null): string {
  if (!code) return 'Unassigned';
  const group = GROUPS[code as GroupCode];
  return group ? group.label : 'Unknown';
}

/**
 * Get the curriculum type for a group (for progress tracking)
 * This uses the parent group to determine curriculum
 */
export function getGroupCurriculumType(code: string | null | undefined): 'A' | 'B' | 'C' | null {
  const parentGroup = getParentGroup(code);
  if (parentGroup === 'A' || parentGroup === 'A1' || parentGroup === 'A2') return 'A';
  if (parentGroup === 'B') return 'B';
  if (parentGroup === 'C') return 'C';
  return null;
}
