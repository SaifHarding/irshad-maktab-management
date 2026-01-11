import { useState, useEffect, useMemo } from "react";
import { useParams, Navigate, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Trash2, Edit, ChevronDown, Users, Search, CheckSquare, Square, X, GraduationCap, Star, RotateCcw, UserX } from "lucide-react";
import { MaktabNav } from "@/components/MaktabNav";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useStudents, Student } from "@/hooks/useStudents";
import { useDeleteStudent } from "@/hooks/useDeleteStudent";
import { useLeftStudents } from "@/hooks/useLeftStudents";
import { StudentProgressEditor } from "@/components/progress/StudentProgressEditor";
import logo from "@/assets/masjid-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast as showToast } from "@/hooks/use-toast";
import { getGroupLabel, getGroupCodesForMaktab, getParentGroup, type GroupCode } from "@/lib/groups";
import { parseDuasStatus } from "@/lib/duasProgress";
import { getSurahLabel } from "@/lib/juzAmma";

import { useQueryClient } from "@tanstack/react-query";
import { useStarStudentCounts } from "@/hooks/useStarStudents";
import { paths } from "@/lib/portalPaths";

const MaktabStudents = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { maktab } = useParams<{ maktab: "boys" | "girls" }>();
  
  if (maktab !== "boys" && maktab !== "girls") {
    return <Navigate to={paths.home()} replace />;
  }

  useEffect(() => {
    if (maktab === "girls") {
      document.documentElement.setAttribute("data-theme", "pink");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [maktab]);

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedNewGroup, setSelectedNewGroup] = useState<GroupCode | "">("");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  
  // Bulk reassign state
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkReassignDialogOpen, setBulkReassignDialogOpen] = useState(false);
  const [bulkTargetGroup, setBulkTargetGroup] = useState<GroupCode | "">("");

  const { students, isLoading } = useStudents(true, maktab);
  const { deleteStudent } = useDeleteStudent();
  const { leftStudents, restoreStudent, isRestoring } = useLeftStudents(maktab);
  const { data: starCounts = {} } = useStarStudentCounts(maktab);
  
  // Left students section state
  const [showLeftStudents, setShowLeftStudents] = useState(false);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.student_code && s.student_code.toLowerCase().includes(query))
    );
  }, [students, searchQuery]);

  const groupedStudents = useMemo(() => {
    // Both maktabs now use groups, get the appropriate ones for this maktab
    const maktabGroups = getGroupCodesForMaktab(maktab);
    const groups: Record<string, Student[]> = {};
    maktabGroups.forEach(code => {
      groups[code] = [];
    });
    groups["Unassigned"] = [];
    
    filteredStudents.forEach(student => {
      const group = student.student_group;
      if (group && groups[group]) {
        groups[group].push(student);
      } else {
        groups["Unassigned"].push(student);
      }
    });
    
    // Remove empty groups
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) delete groups[key];
    });
    
    return groups;
  }, [filteredStudents, maktab]);

  useEffect(() => {
    const initialState: Record<string, boolean> = {};
    Object.keys(groupedStudents).forEach(key => {
      initialState[key] = false;
    });
    setOpenSections(initialState);
  }, [Object.keys(groupedStudents).join(",")]);

  useEffect(() => {
    checkAccess();
  }, [maktab]);


  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate(paths.auth());
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("maktab")
      .eq("id", user.id)
      .single();

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = roles?.map(r => r.role) || [];
    const hasAdminRole = userRoles.includes("admin");
    const hasTeacherRole = userRoles.includes("teacher");
    
    setIsAdmin(hasAdminRole);

    if (hasTeacherRole && !hasAdminRole) {
      if (!profile?.maktab) {
        showToast({
          title: "Access Denied",
          description: "No maktab assigned to your account",
          variant: "destructive",
        });
        navigate(paths.home());
        return;
      }
      
      if (profile.maktab !== maktab) {
        showToast({
          title: "Access Denied",
          description: `You can only access ${profile.maktab} maktab`,
          variant: "destructive",
        });
        navigate(paths.maktabStudents(profile.maktab));
        return;
      }
    }

    setCheckingAccess(false);
  };


  const handleDeleteStudent = (student: Student) => {
    deleteStudent({ 
      id: student.id, 
      studentCode: student.student_code || null, 
      maktab: maktab! 
    });
    setEditDialogOpen(false);
    setEditingStudent(null);
    setShowRemoveConfirm(false);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setEditedName(student.name);
    setSelectedNewGroup("");
    setShowRemoveConfirm(false);
    setIsSavingProgress(false);
    setEditDialogOpen(true);
  };

  const handleSaveProgress = async (data: Partial<Student>) => {
    if (!editingStudent) return;
    setIsSavingProgress(true);
    
    try {
      const { error } = await supabase
        .from("students")
        .update(data)
        .eq("id", editingStudent.id);

      if (error) throw error;

      showToast({ title: "Progress Saved", description: `Progress updated for ${editingStudent.name}` });
      queryClient.invalidateQueries({ queryKey: ["students", maktab] });
      setEditingStudent({ ...editingStudent, ...data });
    } catch (error) {
      showToast({ title: "Error", description: "Failed to save progress", variant: "destructive" });
    } finally {
      setIsSavingProgress(false);
    }
  };

  const handleRenameStudent = async () => {
    if (!editingStudent || !editedName.trim()) return;
    if (editedName.trim() === editingStudent.name) return;

    const { error } = await supabase
      .from("students")
      .update({ name: editedName.trim() })
      .eq("id", editingStudent.id);

    if (error) {
      showToast({ title: "Error", description: "Failed to rename student", variant: "destructive" });
      return;
    }

    showToast({ title: "Student Renamed", description: `Student renamed to ${editedName.trim()}` });
    queryClient.invalidateQueries({ queryKey: ["students", maktab] });
    setEditingStudent({ ...editingStudent, name: editedName.trim() });
  };

  const handleReassignStudent = async () => {
    if (!editingStudent || !selectedNewGroup) return;

    const { error } = await supabase
      .from("students")
      .update({ student_group: selectedNewGroup })
      .eq("id", editingStudent.id);

    if (error) {
      showToast({ title: "Error", description: "Failed to reassign student", variant: "destructive" });
      return;
    }

    showToast({ title: "Student Reassigned", description: `${editingStudent.name} moved to ${getGroupLabel(selectedNewGroup)}` });
    queryClient.invalidateQueries({ queryKey: ["students", maktab] });
    setEditDialogOpen(false);
    setEditingStudent(null);
    setSelectedNewGroup("");
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handleBulkReassign = async () => {
    if (selectedStudents.size === 0 || !bulkTargetGroup) return;

    const { error } = await supabase
      .from("students")
      .update({ student_group: bulkTargetGroup })
      .in("id", Array.from(selectedStudents));

    if (error) {
      showToast({ title: "Error", description: "Failed to reassign students", variant: "destructive" });
      return;
    }

    showToast({ 
      title: "Students Reassigned", 
      description: `${selectedStudents.size} student(s) moved to ${getGroupLabel(bulkTargetGroup)}` 
    });
    queryClient.invalidateQueries({ queryKey: ["students", maktab] });
    setBulkReassignDialogOpen(false);
    setBulkTargetGroup("");
    setSelectedStudents(new Set());
    setBulkSelectMode(false);
  };

  const exitBulkMode = () => {
    setBulkSelectMode(false);
    setSelectedStudents(new Set());
  };

  const toggleSelectAllInGroup = (groupStudents: Student[]) => {
    const studentIds = groupStudents.map(s => s.id);
    const allSelected = studentIds.every(id => selectedStudents.has(id));
    
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        studentIds.forEach(id => newSet.delete(id));
      } else {
        studentIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const isGroupFullySelected = (groupStudents: Student[]) => {
    return groupStudents.length > 0 && groupStudents.every(s => selectedStudents.has(s.id));
  };

  if (checkingAccess || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const currentStudentGroup = editingStudent?.student_group as GroupCode | null;
  const otherGroups = getGroupCodesForMaktab(maktab).filter(g => g !== currentStudentGroup);

  const getGroupDisplayName = (key: string) => {
    if (key === "All Students" || key === "Unassigned") return key;
    return getGroupLabel(key);
  };

  const getDuasBadge = (duasStatus: string | null | undefined): { text: string; isBook2: boolean } | null => {
    if (!duasStatus) return null;
    const parsed = parseDuasStatus(duasStatus);
    if (parsed.completed) return { text: "Duas ✓", isBook2: false };
    if (parsed.book && parsed.level) {
      const bookNum = parsed.book === "Book 1" ? "B1" : "B2";
      return { text: `Duas ${bookNum} Lvl ${parsed.level}`, isBook2: parsed.book === "Book 2" };
    }
    if (parsed.book) {
      const bookNum = parsed.book === "Book 1" ? "B1" : "B2";
      return { text: `Duas ${bookNum}`, isBook2: parsed.book === "Book 2" };
    }
    return null;
  };

  // Badge color classes by category
  const badgeColors: Record<string, string> = {
    qaidah: "bg-blue-500/15 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-600",
    duas_b1: "bg-purple-500/15 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-600",
    duas_b2: "bg-sky-500/15 text-sky-700 border-sky-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-600",
    quran: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-600",
    tajweed: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-600",
    juzamma: "bg-teal-500/15 text-teal-700 border-teal-300 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-600",
    sabak: "bg-rose-500/15 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-600",
    spara: "bg-cyan-500/15 text-cyan-700 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-600",
    daur: "bg-indigo-500/15 text-indigo-700 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-600",
    hafiz: "bg-green-600 text-white border-green-700",
  };

  const getProgressBadge = (student: Student) => {
    const group = student.student_group;
    const parentGroup = getParentGroup(group);
    const badges: { text: string; color: string; isGraduated: boolean }[] = [];

    // Use parent group for progress type determination
    if (parentGroup === "A") {
      if (student.qaidah_level) badges.push({ text: `Qaidah ${student.qaidah_level}`, color: badgeColors.qaidah, isGraduated: false });
      const duasBadge = getDuasBadge(student.duas_status);
      if (duasBadge) badges.push({ text: duasBadge.text, color: duasBadge.isBook2 ? badgeColors.duas_b2 : badgeColors.duas_b1, isGraduated: false });
    } else if (parentGroup === "B") {
      if (student.quran_completed) {
        badges.push({ text: "Quran ✓", color: badgeColors.quran, isGraduated: false });
      } else if (student.quran_juz) {
        badges.push({ text: `Juz ${student.quran_juz}`, color: badgeColors.quran, isGraduated: false });
      }
      if (student.tajweed_completed) {
        badges.push({ text: "Tajweed ✓", color: badgeColors.tajweed, isGraduated: false });
      } else if (student.tajweed_level) {
        badges.push({ text: `Tajweed ${student.tajweed_level}`, color: badgeColors.tajweed, isGraduated: false });
      }
      const duasBadge = getDuasBadge(student.duas_status);
      if (duasBadge) badges.push({ text: duasBadge.text, color: duasBadge.isBook2 ? badgeColors.duas_b2 : badgeColors.duas_b1, isGraduated: false });
    } else if (parentGroup === "C") {
      if (student.hifz_graduated) {
        return [{ text: "Hafiz", color: badgeColors.hafiz, isGraduated: true }];
      }
      
      // Check if on Juz Amma track
      const juzAmmaSurah = (student as any).juz_amma_surah;
      const juzAmmaCompleted = (student as any).juz_amma_completed || false;
      const isOnJuzAmmaTrack = !juzAmmaCompleted && !student.hifz_sabak;
      
      if (isOnJuzAmmaTrack && juzAmmaSurah) {
        const surah = getSurahLabel(juzAmmaSurah);
        badges.push({ text: `JA: ${surah}`, color: badgeColors.juzamma, isGraduated: false });
      } else {
        if (student.hifz_sabak) badges.push({ text: `Sabak ${student.hifz_sabak}`, color: badgeColors.sabak, isGraduated: false });
        if (student.hifz_s_para) badges.push({ text: `S.Para ${student.hifz_s_para}`, color: badgeColors.spara, isGraduated: false });
        if (student.hifz_daur) badges.push({ text: `Daur ${student.hifz_daur}`, color: badgeColors.daur, isGraduated: false });
      }
    }

    return badges;
  };

  return (
    <div className="min-h-screen bg-background p-4 safe-top safe-bottom">
      <div className="space-y-6">
        <div className="space-y-4">
          <MaktabNav maktab={maktab!} isAdmin={isAdmin} currentPage="students" />

          <div className="flex items-center gap-4">
            <img src={logo} alt="Masjid Logo" className="w-20 h-20" />
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                {maktab === "boys" ? "Boys" : "Girls"} Students
              </h1>
              <p className="text-muted-foreground text-lg mt-2">
                Manage students
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">
                All Students ({students.length})
              </CardTitle>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                {bulkSelectMode ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exitBulkMode}
                      className="h-10"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setBulkReassignDialogOpen(true)}
                      disabled={selectedStudents.size === 0}
                      className="h-10"
                    >
                      Reassign ({selectedStudents.size})
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBulkSelectMode(true)}
                      className="h-10"
                    >
                      <CheckSquare className="w-4 h-4 mr-1" />
                      Bulk Reassign
                    </Button>
                  </>
                )}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-lg"
              />
            </div>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No students found. Add your first student above.
              </p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No students match "{searchQuery}"
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedStudents).map(([groupKey, groupStudents]) => (
                  <Collapsible
                    key={groupKey}
                    open={openSections[groupKey]}
                    onOpenChange={() => toggleSection(groupKey)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between h-14 text-lg font-semibold hover:bg-accent/50 px-4"
                      >
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-primary" />
                          <span>{getGroupDisplayName(groupKey)}</span>
                          <span className="text-muted-foreground font-normal">
                            ({groupStudents.length})
                          </span>
                        </div>
                        <ChevronDown className={`w-5 h-5 transition-transform ${openSections[groupKey] ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2 pl-2">
                      {bulkSelectMode && groupStudents.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectAllInGroup(groupStudents);
                          }}
                          className="w-full h-10 mb-2 text-sm"
                        >
                          {isGroupFullySelected(groupStudents) ? (
                            <>
                              <Square className="w-4 h-4 mr-2" />
                              Deselect All ({groupStudents.length})
                            </>
                          ) : (
                            <>
                              <CheckSquare className="w-4 h-4 mr-2" />
                              Select All ({groupStudents.length})
                            </>
                          )}
                        </Button>
                      )}
                    {groupStudents.map((student) => (
                        <div
                          key={student.id}
                          className={`flex items-center justify-between p-4 rounded-lg border bg-card ${
                            bulkSelectMode && selectedStudents.has(student.id) ? 'border-primary bg-primary/5' : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              {bulkSelectMode && (
                                <Checkbox
                                  checked={selectedStudents.has(student.id)}
                                  onCheckedChange={() => toggleStudentSelection(student.id)}
                                  className="h-6 w-6"
                                />
                              )}
                              {student.student_code && (
                                <Badge 
                                  variant="secondary" 
                                  className="font-mono text-xs bg-muted text-muted-foreground shrink-0"
                                >
                                  {student.student_code}
                                </Badge>
                              )}
                              <span className="font-semibold text-lg">{student.name}</span>
                              {starCounts[student.id] > 0 && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                  {starCounts[student.id] > 1 && (
                                    <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                                      {starCounts[student.id]}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {!bulkSelectMode && getProgressBadge(student).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 ml-0">
                                {getProgressBadge(student).map((badge, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className={`text-xs border ${badge.color}`}
                                  >
                                    {badge.isGraduated && <GraduationCap className="w-3 h-3 mr-1" />}
                                    {badge.text}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          {!bulkSelectMode && (
                            <Button
                              variant="ghost"
                              size="lg"
                              onClick={() => handleEditStudent(student)}
                              className="h-12 w-12 p-0 touch-manipulation"
                            >
                              <Edit className="w-5 h-5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Left Students Section */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <Collapsible open={showLeftStudents} onOpenChange={setShowLeftStudents}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between h-14 text-lg font-semibold hover:bg-accent/50 px-4 -mx-4"
                  >
                    <div className="flex items-center gap-3">
                      <UserX className="w-5 h-5 text-muted-foreground" />
                      <span>Left Students</span>
                      <span className="text-muted-foreground font-normal">
                        ({leftStudents.length})
                      </span>
                    </div>
                    <ChevronDown className={`w-5 h-5 transition-transform ${showLeftStudents ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  {leftStudents.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      No students marked as left.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {leftStudents.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3">
                            {student.student_code && (
                              <Badge 
                                variant="secondary" 
                                className="font-mono text-xs bg-muted text-muted-foreground shrink-0"
                              >
                                {student.student_code}
                              </Badge>
                            )}
                            <span className="font-semibold text-lg">{student.name}</span>
                            {student.student_group && (
                              <Badge variant="outline" className="text-xs">
                                {getGroupLabel(student.student_group)}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreStudent(student.id)}
                            disabled={isRestoring}
                            className="h-10"
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Restore
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </CardHeader>
          </Card>
        )}
      </div>
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent 
          className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-6"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="space-y-1 pb-2">
            <DialogTitle className="text-xl font-bold">Edit Student</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-5">
            {/* Rename Section */}
            <div className="space-y-2">
              <label className="text-base font-medium">Student Name</label>
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="h-14 text-base"
                placeholder="Student name"
                autoFocus={false}
              />
              <Button
                onClick={handleRenameStudent}
                disabled={!editedName.trim() || editedName.trim() === editingStudent?.name}
                className="w-full h-12"
                variant="secondary"
              >
                Rename Student
              </Button>
            </div>

            {/* Progress Section */}
            {editingStudent && (
              <div className="border-t pt-5">
                <StudentProgressEditor
                  student={editingStudent}
                  onSave={handleSaveProgress}
                  isSaving={isSavingProgress}
                />
              </div>
            )}

            {otherGroups.length > 0 && (
              <div className="space-y-3 border-t pt-5">
                <label className="text-base font-medium">Reassign to Group</label>
                <Select value={selectedNewGroup} onValueChange={(val) => setSelectedNewGroup(val as GroupCode)}>
                  <SelectTrigger className="h-14 text-base">
                    <SelectValue placeholder="Select group..." />
                  </SelectTrigger>
                  <SelectContent>
                    {otherGroups.map((code) => (
                      <SelectItem key={code} value={code} className="text-base py-3">
                        {getGroupLabel(code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleReassignStudent}
                  disabled={!selectedNewGroup}
                  className="w-full h-12"
                >
                  Reassign Student
                </Button>
              </div>
            )}

            {isAdmin && (
              <div className="border-t pt-5">
                {!showRemoveConfirm ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowRemoveConfirm(true)}
                    className="w-full h-12 text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Remove Student
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                    <p className="text-sm text-center">
                      Remove <strong>{editingStudent?.name}</strong>?
                      <br />
                      <span className="text-muted-foreground">Attendance history will be preserved.</span>
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowRemoveConfirm(false)}
                        className="h-12"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => editingStudent && handleDeleteStudent(editingStudent)}
                        className="h-12"
                      >
                        Yes, Remove
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Reassign Dialog */}
      <Dialog open={bulkReassignDialogOpen} onOpenChange={setBulkReassignDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-bold text-center">Bulk Reassign Students</DialogTitle>
            <DialogDescription className="text-center">
              Reassign {selectedStudents.size} selected student(s) to a new group
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            <Select value={bulkTargetGroup} onValueChange={(val) => setBulkTargetGroup(val as GroupCode)}>
              <SelectTrigger className="h-14 text-lg">
                <SelectValue placeholder="Select target group..." />
              </SelectTrigger>
              <SelectContent>
                {getGroupCodesForMaktab(maktab).map((code) => (
                  <SelectItem key={code} value={code} className="text-lg py-3">
                    {getGroupLabel(code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setBulkReassignDialogOpen(false)}
                className="h-14 text-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkReassign}
                disabled={!bulkTargetGroup}
                className="h-14 text-lg"
              >
                Reassign All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default MaktabStudents;
