import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Link2, Unlink, Search, Plus, Users } from "lucide-react";

interface ParentProfile {
  id: string;
  email: string;
  full_name: string | null;
}

interface Student {
  id: string;
  name: string;
  student_code: string | null;
  maktab: string;
}

interface ParentStudentLink {
  id: string;
  parent_id: string;
  student_id: string;
  student_name: string;
  student_code: string | null;
}

interface Props {
  trigger?: React.ReactNode;
}

export function ManageParentLinksDialog({ trigger }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // Fetch all parent profiles
  const { data: parents, isLoading: parentsLoading } = useQuery({
    queryKey: ["all-parent-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parent_profiles")
        .select("id, email, full_name")
        .order("full_name");
      if (error) throw error;
      return data as ParentProfile[];
    },
    enabled: open,
  });

  // Fetch links for selected parent
  const { data: existingLinks, isLoading: linksLoading } = useQuery({
    queryKey: ["parent-student-links", selectedParentId],
    queryFn: async () => {
      if (!selectedParentId) return [];
      const { data, error } = await supabase
        .from("parent_student_links")
        .select("id, parent_id, student_id, students(name, student_code)")
        .eq("parent_id", selectedParentId);
      if (error) throw error;
      return (data || []).map((link: any) => ({
        id: link.id,
        parent_id: link.parent_id,
        student_id: link.student_id,
        student_name: link.students?.name || "Unknown",
        student_code: link.students?.student_code || null,
      })) as ParentStudentLink[];
    },
    enabled: !!selectedParentId,
  });

  // Fetch all students for linking
  const { data: allStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ["all-active-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, student_code, maktab")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as Student[];
    },
    enabled: open,
  });

  // Filter students not already linked
  const linkedStudentIds = new Set(existingLinks?.map(l => l.student_id) || []);
  const filteredStudents = allStudents?.filter(student => {
    if (linkedStudentIds.has(student.id)) return false;
    if (!studentSearchQuery) return true;
    const query = studentSearchQuery.toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      student.student_code?.toLowerCase().includes(query)
    );
  }) || [];

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from("parent_student_links")
        .insert({
          parent_id: selectedParentId,
          student_id: studentId,
          verified_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-student-links", selectedParentId] });
      queryClient.invalidateQueries({ queryKey: ["registered-parents"] });
      queryClient.invalidateQueries({ queryKey: ["students-portal-status"] });
      toast({ title: "Student linked successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to link student", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Unlink mutation
  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("parent_student_links")
        .delete()
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-student-links", selectedParentId] });
      queryClient.invalidateQueries({ queryKey: ["registered-parents"] });
      queryClient.invalidateQueries({ queryKey: ["students-portal-status"] });
      toast({ title: "Student unlinked successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to unlink student", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const selectedParent = parents?.find(p => p.id === selectedParentId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Link2 className="h-4 w-4 mr-2" />
            Manage Links
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Manage Parent-Student Links
          </DialogTitle>
          <DialogDescription>
            Manually link or unlink students to parent accounts
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Parent Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Parent</label>
            {parentsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a parent..." />
                </SelectTrigger>
                <SelectContent>
                  {parents?.map(parent => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.full_name || parent.email} ({parent.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedParentId && (
            <>
              {/* Currently Linked Students */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Linked Students ({existingLinks?.length || 0})
                </label>
                {linksLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : existingLinks?.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No students linked to this parent
                  </p>
                ) : (
                  <div className="space-y-2">
                    {existingLinks?.map(link => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-2 border rounded-lg bg-card"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {link.student_code}
                          </Badge>
                          <span className="text-sm font-medium">{link.student_name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => unlinkMutation.mutate(link.id)}
                          disabled={unlinkMutation.isPending}
                        >
                          <Unlink className="h-4 w-4 mr-1" />
                          Unlink
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Link */}
              <div className="space-y-2 border-t pt-4">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Link New Student
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students by name or code..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {studentsLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    {studentSearchQuery ? "No matching students found" : "All students are already linked"}
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                    {filteredStudents.slice(0, 20).map(student => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-2 hover:bg-muted rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {student.maktab === "boys" ? "B" : "G"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {student.student_code}
                          </Badge>
                          <span className="text-sm">{student.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => linkMutation.mutate(student.id)}
                          disabled={linkMutation.isPending}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Link
                        </Button>
                      </div>
                    ))}
                    {filteredStudents.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Showing first 20 results. Refine your search to see more.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
