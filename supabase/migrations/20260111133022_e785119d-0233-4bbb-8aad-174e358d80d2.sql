-- Remove the existing check constraint on student_group
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_student_group_check;

-- Remove check constraint from teacher_groups if exists
ALTER TABLE teacher_groups DROP CONSTRAINT IF EXISTS teacher_groups_group_code_check;

-- Remove check constraint from attendance_day_logs if exists
ALTER TABLE attendance_day_logs DROP CONSTRAINT IF EXISTS attendance_day_logs_student_group_check;

-- Remove check constraint from student_progress_snapshots if exists
ALTER TABLE student_progress_snapshots DROP CONSTRAINT IF EXISTS student_progress_snapshots_student_group_check;

-- Migrate existing Group A students to A1 for boys maktab
UPDATE students 
SET student_group = 'A1' 
WHERE student_group = 'A' AND maktab = 'boys';

-- Update teacher group assignments
UPDATE teacher_groups 
SET group_code = 'A1' 
WHERE group_code = 'A' AND maktab = 'boys';

-- Update attendance day logs
UPDATE attendance_day_logs 
SET student_group = 'A1' 
WHERE student_group = 'A' AND maktab = 'boys';