import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Users, GraduationCap, BookOpen, Book } from "lucide-react";
import {
  useMaktabClasses,
  useCreateMaktabClass,
  useUpdateMaktabClass,
  useDeleteMaktabClass,
  MaktabClass,
} from "@/hooks/useMaktabClasses";
import { useStudents } from "@/hooks/useStudents";
import { toast } from "@/hooks/use-toast";

const PARENT_GROUP_OPTIONS = [
  { value: "A", label: "Group A (Qaidah)", icon: Book },
  { value: "B", label: "Group B (Quran)", icon: BookOpen },
  { value: "C", label: "Group C (Hifz)", icon: GraduationCap },
];

interface ClassCardProps {
  classItem: MaktabClass;
  studentCount: number;
  onEdit: (classItem: MaktabClass) => void;
  onDelete: (classItem: MaktabClass) => void;
}

function ClassCard({ classItem, studentCount, onEdit, onDelete }: ClassCardProps) {
  const canDelete = studentCount === 0;

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{classItem.name}</CardTitle>
            <CardDescription className="text-sm">
              Code: <span className="font-mono font-medium">{classItem.code}</span>
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {classItem.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Users className="h-4 w-4" />
          <span>{studentCount} student{studentCount !== 1 ? "s" : ""}</span>
          {classItem.parent_group && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>Sub-group of {classItem.parent_group}</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(classItem)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={!canDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {classItem.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the class.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(classItem)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {!canDelete && (
            <span className="text-xs text-muted-foreground self-center ml-1">
              (Has students)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface AddClassDialogProps {
  maktab: string;
  existingClasses: MaktabClass[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddClassDialog({ maktab, existingClasses, open, onOpenChange }: AddClassDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [parentGroup, setParentGroup] = useState<string>("");
  const createClass = useCreateMaktabClass();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !name.trim() || !label.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate code
    if (existingClasses.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
      toast({
        title: "Duplicate code",
        description: "A class with this code already exists in this maktab.",
        variant: "destructive",
      });
      return;
    }

    const maxOrder = Math.max(...existingClasses.map((c) => c.display_order), 0);

    await createClass.mutateAsync({
      code: code.toUpperCase(),
      name,
      label,
      parent_group: parentGroup || null,
      maktab,
      display_order: maxOrder + 1,
    });

    setCode("");
    setName("");
    setLabel("");
    setParentGroup("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Class</DialogTitle>
          <DialogDescription>
            Create a new class for the {maktab} maktab. Use parent group to create sub-classes
            (e.g., B1, B2 under Group B).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Class Code *</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g., B1"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Group B1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label/Curriculum *</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Quran"
              />
              <p className="text-xs text-muted-foreground">
                The curriculum type (Qaidah, Quran, or Hifz)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentGroup">Parent Group (for sub-classes)</Label>
              <Select value={parentGroup} onValueChange={setParentGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="None (main group)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (main group)</SelectItem>
                  {PARENT_GROUP_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sub-classes inherit progress tracking from parent group
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createClass.isPending}>
              {createClass.isPending ? "Creating..." : "Create Class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditClassDialogProps {
  classItem: MaktabClass | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditClassDialog({ classItem, open, onOpenChange }: EditClassDialogProps) {
  const [name, setName] = useState(classItem?.name ?? "");
  const [label, setLabel] = useState(classItem?.label ?? "");
  const updateClass = useUpdateMaktabClass();

  // Update local state when classItem changes
  useState(() => {
    if (classItem) {
      setName(classItem.name);
      setLabel(classItem.label);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!classItem || !name.trim() || !label.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    await updateClass.mutateAsync({
      id: classItem.id,
      updates: { name, label },
    });

    onOpenChange(false);
  };

  if (!classItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {classItem.code}</DialogTitle>
          <DialogDescription>
            Update the display name or label for this class. The code cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Class Code</Label>
              <Input value={classItem.code} disabled className="font-mono bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Display Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Group B1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-label">Label/Curriculum *</Label>
              <Input
                id="edit-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Quran"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateClass.isPending}>
              {updateClass.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MaktabClassManager() {
  const [selectedMaktab, setSelectedMaktab] = useState<"boys" | "girls">("boys");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<MaktabClass | null>(null);

  const { data: classes = [], isLoading } = useMaktabClasses(selectedMaktab);
  const { students: allStudents = [] } = useStudents(true, selectedMaktab);
  const deleteClass = useDeleteMaktabClass();

  // Count students per class
  const studentCounts = allStudents.reduce(
    (acc, student) => {
      const group = student.student_group || "unassigned";
      acc[group] = (acc[group] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const handleEdit = (classItem: MaktabClass) => {
    setEditingClass(classItem);
    setEditDialogOpen(true);
  };

  const handleDelete = async (classItem: MaktabClass) => {
    await deleteClass.mutateAsync(classItem.id);
  };

  // Group classes by parent group
  const mainGroups = classes.filter((c) => !c.parent_group);
  const subGroups = classes.filter((c) => c.parent_group);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Maktab Classes
            </CardTitle>
            <CardDescription>
              Manage class groups and sub-groups for each maktab
            </CardDescription>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Class
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedMaktab} onValueChange={(v) => setSelectedMaktab(v as "boys" | "girls")}>
          <TabsList className="mb-4">
            <TabsTrigger value="boys">Boys Maktab</TabsTrigger>
            <TabsTrigger value="girls">Girls Maktab</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedMaktab}>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading classes...</div>
            ) : classes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No classes configured for this maktab.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Main Groups */}
                {mainGroups.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Main Groups</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {mainGroups.map((classItem) => (
                        <ClassCard
                          key={classItem.id}
                          classItem={classItem}
                          studentCount={studentCounts[classItem.code] || 0}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-Groups */}
                {subGroups.length > 0 && (
                  <div>
                    {mainGroups.length > 0 && <Separator className="my-6" />}
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Sub-Groups</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subGroups.map((classItem) => (
                        <ClassCard
                          key={classItem.id}
                          classItem={classItem}
                          studentCount={studentCounts[classItem.code] || 0}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <AddClassDialog
          maktab={selectedMaktab}
          existingClasses={classes}
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
        />

        <EditClassDialog
          classItem={editingClass}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingClass(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
