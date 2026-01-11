import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, UserPlus, Trash2, KeyRound, Edit, Ghost, Crown } from "lucide-react";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getGroupLabel, getGroupCodesForMaktab, type GroupCode } from "@/lib/groups";
import { useAllTeacherGroups } from "@/hooks/useTeacherGroup";
import { useGhostMode } from "@/contexts/GhostModeContext";
import { paths } from "@/lib/portalPaths";

const usernameSchema = z.string().trim().min(3, { message: "Username must be at least 3 characters" }).max(20);
const passwordSchema = z.string().min(6, { message: "Password must be at least 6 characters" });
const nameSchema = z.string().trim().min(1, { message: "Name is required" });

type RoleType = "teacher" | "admin" | "head_teacher";

interface User {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  roles: string[];
  maktab: string | null;
  must_change_password: boolean;
  is_head_teacher: boolean;
}

const UserManagement = () => {
  const navigate = useNavigate();
  const { enterGhostMode } = useGhostMode();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleType, setRoleType] = useState<RoleType>("teacher");
  const [maktab, setMaktab] = useState<"boys" | "girls">("girls");
  const [groups, setGroups] = useState<GroupCode[]>([]);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  
  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRoleType, setEditRoleType] = useState<RoleType>("teacher");
  const [editMaktab, setEditMaktab] = useState<"boys" | "girls" | null>(null);
  const [editGroups, setEditGroups] = useState<GroupCode[]>([]);
  const [savingUser, setSavingUser] = useState(false);
  
  const { teacherGroups: boysTeacherGroups, refetch: refetchBoysTeacherGroups } = useAllTeacherGroups("boys");
  const { teacherGroups: girlsTeacherGroups, refetch: refetchGirlsTeacherGroups } = useAllTeacherGroups("girls");

  // Check if a head teacher already exists for a given maktab
  const getExistingHeadTeacher = (maktabValue: string, excludeUserId?: string) => {
    return users.find(u => 
      u.is_head_teacher && 
      u.maktab === maktabValue && 
      u.id !== excludeUserId
    );
  };

  const handleEnterGhostMode = (user: User) => {
    if (!user.full_name || !user.maktab) {
      toast({
        title: "Cannot Enter Ghost Mode",
        description: "User must have a full name and maktab assigned",
        variant: "destructive",
      });
      return;
    }
    
    enterGhostMode({
      id: user.id,
      full_name: user.full_name,
      maktab: user.maktab as "boys" | "girls",
    });
    
    toast({
      title: "Ghost Mode Activated",
      description: `Now viewing as ${user.full_name}`,
    });
    
    // Navigate to the teacher's maktab
    navigate(paths.maktab(user.maktab));
  };

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate(paths.auth());
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      toast({
        title: "Access Denied",
        description: "You do not have admin privileges",
        variant: "destructive",
      });
      navigate(paths.home());
      return;
    }

    setIsAdmin(true);
    setLoading(false);
    loadUsers();
  };

  const loadUsers = async () => {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        full_name,
        email,
        maktab,
        must_change_password,
        is_head_teacher
      `);

    if (!profilesData) return;

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      profilesData.map(async (profile) => {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.id);

        return {
          ...profile,
          roles: rolesData?.map(r => r.role) || [],
        };
      })
    );

    setUsers(usersWithRoles);
  };

  const getRolesFromRoleType = (type: RoleType): ("admin" | "teacher")[] => {
    switch (type) {
      case "teacher":
        return ["teacher"];
      case "admin":
        return ["admin"];
      case "head_teacher":
        return ["admin", "teacher"];
      default:
        return ["teacher"];
    }
  };

  const getRoleTypeFromUser = (user: User): RoleType => {
    if (user.is_head_teacher) return "head_teacher";
    if (user.roles.includes("admin") && user.roles.includes("teacher")) return "head_teacher";
    if (user.roles.includes("admin")) return "admin";
    return "teacher";
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      usernameSchema.parse(username);
      passwordSchema.parse(password);
      nameSchema.parse(fullName);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.issues[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    // Check for existing head teacher
    if (roleType === "head_teacher") {
      const existingHT = getExistingHeadTeacher(maktab);
      if (existingHT) {
        toast({
          title: "Head Teacher Already Exists",
          description: `${existingHT.full_name} is already the head teacher for ${maktab === "boys" ? "Boys" : "Girls"} Maktab`,
          variant: "destructive",
        });
        return;
      }
    }

    setCreating(true);

    try {
      const roles = getRolesFromRoleType(roleType);
      const isHeadTeacher = roleType === "head_teacher";
      const needsMaktab = roleType === "teacher" || roleType === "head_teacher";

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { 
          username, 
          password, 
          fullName,
          email: email || null,
          roles,
          maktab: needsMaktab ? maktab : null,
          isHeadTeacher,
        },
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Error Creating User",
          description: data.error,
          variant: "destructive",
        });
        setCreating(false);
        return;
      }

      // Insert teacher group assignments if teacher/head teacher role and groups selected
      if (needsMaktab && groups.length > 0 && fullName) {
        const inserts = groups.map(groupCode => ({
          teacher_name: fullName,
          group_code: groupCode,
          maktab: maktab,
        }));
        const { error: groupError } = await supabase.from("teacher_groups").insert(inserts);
        if (groupError) {
          console.error("Failed to insert teacher groups:", groupError);
          toast({
            title: "Warning",
            description: "User created but group assignments failed. Please edit the user to assign groups.",
            variant: "destructive",
          });
        }
        if (maktab === "boys") {
          refetchBoysTeacherGroups();
        } else {
          refetchGirlsTeacherGroups();
        }
      }

      toast({
        title: "User Created",
        description: `${username} has been created successfully`,
      });

      setUsername("");
      setPassword("");
      setFullName("");
      setEmail("");
      setRoleType("teacher");
      setMaktab("girls");
      setGroups([]);
      setCreating(false);
      loadUsers();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create user";
      toast({
        title: "Error Creating User",
        description: errorMessage,
        variant: "destructive",
      });
      setCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: deleteUserId },
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Error Deleting User",
          description: data.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "User Deleted",
          description: "User has been removed successfully",
        });
        loadUsers();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete user";
      toast({
        title: "Error Deleting User",
        description: errorMessage,
        variant: "destructive",
      });
    }

    setDeleteUserId(null);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId || !newPassword) return;

    try {
      passwordSchema.parse(newPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.issues[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setResettingPassword(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { userId: resetPasswordUserId, newPassword },
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Error Resetting Password",
          description: data.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password Reset",
          description: "Password has been reset successfully",
        });
        setResetPasswordUserId(null);
        setNewPassword("");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reset password";
      toast({
        title: "Error Resetting Password",
        description: errorMessage,
        variant: "destructive",
      });
    }

    setResettingPassword(false);
  };

  const handleEditUser = async (user: User) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditFullName(user.full_name || "");
    setEditEmail(user.email || "");
    setEditRoleType(getRoleTypeFromUser(user));
    setEditMaktab(user.maktab as "boys" | "girls" | null);
    
    // Fetch assigned groups directly from database to ensure fresh data
    if (user.full_name && user.maktab) {
      const { data: groupsData } = await supabase
        .from("teacher_groups")
        .select("group_code")
        .eq("teacher_name", user.full_name)
        .eq("maktab", user.maktab);
      
      const assignedGroups = groupsData?.map(g => g.group_code as GroupCode) || [];
      setEditGroups(assignedGroups);
    } else {
      setEditGroups([]);
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    try {
      usernameSchema.parse(editUsername);
      nameSchema.parse(editFullName);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.issues[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    // Check for existing head teacher (when changing to head teacher)
    if (editRoleType === "head_teacher" && editMaktab) {
      const existingHT = getExistingHeadTeacher(editMaktab, editingUser.id);
      if (existingHT) {
        toast({
          title: "Head Teacher Already Exists",
          description: `${existingHT.full_name} is already the head teacher for ${editMaktab === "boys" ? "Boys" : "Girls"} Maktab`,
          variant: "destructive",
        });
        return;
      }
    }

    setSavingUser(true);

    try {
      const roles = getRolesFromRoleType(editRoleType);
      const isHeadTeacher = editRoleType === "head_teacher";
      const needsMaktab = editRoleType === "teacher" || editRoleType === "head_teacher";

      const { data, error } = await supabase.functions.invoke('update-user', {
        body: {
          userId: editingUser.id,
          username: editUsername,
          fullName: editFullName,
          email: editEmail || null,
          roles,
          maktab: needsMaktab ? editMaktab : null,
          isHeadTeacher,
        },
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Error Updating User",
          description: data.error,
          variant: "destructive",
        });
        setSavingUser(false);
        return;
      }

      // Update teacher group assignments
      if (needsMaktab && editMaktab && editFullName) {
        // Delete existing assignments for this teacher in this maktab
        await supabase.from("teacher_groups").delete().eq("teacher_name", editFullName).eq("maktab", editMaktab);
        // Insert new assignments (multiple groups)
        if (editGroups.length > 0) {
          const inserts = editGroups.map(groupCode => ({
            teacher_name: editFullName,
            group_code: groupCode,
            maktab: editMaktab,
          }));
          await supabase.from("teacher_groups").insert(inserts);
        }
        if (editMaktab === "boys") {
          refetchBoysTeacherGroups();
        } else {
          refetchGirlsTeacherGroups();
        }
      }

      toast({
        title: "User Updated",
        description: "User has been updated successfully",
      });
      setEditingUser(null);
      loadUsers();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update user";
      toast({
        title: "Error Updating User",
        description: errorMessage,
        variant: "destructive",
      });
    }

    setSavingUser(false);
  };

  // Get role badge display - Head Teachers show only one badge, not separate admin/teacher badges
  const getRoleBadge = (user: User) => {
    const isHeadTeacher = user.is_head_teacher || (user.roles.includes("admin") && user.roles.includes("teacher"));
    
    if (isHeadTeacher) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <Crown className="h-3 w-3" />
          Head Teacher
        </span>
      );
    }
    
    return user.roles.map((role) => (
      <span
        key={role}
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          role === "admin" 
            ? "bg-purple-100 text-purple-800" 
            : "bg-blue-100 text-blue-800"
        }`}
      >
        {role}
      </span>
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const needsMaktab = roleType === "teacher" || roleType === "head_teacher";
  const editNeedsMaktab = editRoleType === "teacher" || editRoleType === "head_teacher";

  // Show warning if head teacher already exists for selected maktab
  const existingHeadTeacherWarning = roleType === "head_teacher" ? getExistingHeadTeacher(maktab) : null;
  const editExistingHeadTeacherWarning = editRoleType === "head_teacher" && editMaktab 
    ? getExistingHeadTeacher(editMaktab, editingUser?.id) 
    : null;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 safe-top safe-bottom">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to={paths.admin()}>
              <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold">User Management</h1>
          </div>
        </div>

        {/* Create User Card */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <UserPlus className="h-5 w-5" />
              Create New User
            </CardTitle>
            <CardDescription>Add a new teacher, admin, or head teacher to the system</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input
                    id="full-name"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (for notifications)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="teacher@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for payment notifications (required for Head Teachers)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-type">Role Type</Label>
                  <Select value={roleType} onValueChange={(value: RoleType) => setRoleType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="head_teacher">Head Teacher (Admin + Teacher)</SelectItem>
                    </SelectContent>
                  </Select>
                  {roleType === "head_teacher" && (
                    <p className="text-xs text-muted-foreground">
                      Head Teacher has both admin and teacher privileges. Only one per maktab allowed.
                    </p>
                  )}
                </div>
                {needsMaktab && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="maktab">Maktab</Label>
                      <Select value={maktab} onValueChange={(value: "boys" | "girls") => {
                        setMaktab(value);
                        setGroups([]); // Reset groups when maktab changes
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="girls">Girls Maktab</SelectItem>
                          <SelectItem value="boys">Boys Maktab</SelectItem>
                        </SelectContent>
                      </Select>
                      {existingHeadTeacherWarning && (
                        <p className="text-xs text-destructive font-medium">
                          ⚠️ {existingHeadTeacherWarning.full_name} is already the head teacher for {maktab === "boys" ? "Boys" : "Girls"} Maktab
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Assigned Groups</Label>
                      <div className="flex flex-wrap gap-3">
                        {getGroupCodesForMaktab(maktab).map((code) => (
                          <label key={code} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={groups.includes(code as GroupCode)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setGroups([...groups, code as GroupCode]);
                                } else {
                                  setGroups(groups.filter(g => g !== code));
                                }
                              }}
                              className="rounded border-input h-5 w-5"
                            />
                            <span className="text-sm">{getGroupLabel(code)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <Button type="submit" disabled={creating || !!existingHeadTeacherWarning} className="w-full sm:w-auto">
                {creating ? "Creating..." : "Create User"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Users List Card */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">All Users</CardTitle>
            <CardDescription>Manage existing users in the system</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {users.map((user) => (
                <div key={user.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{user.username}</p>
                      <p className="text-sm text-muted-foreground">{user.full_name || "No name"}</p>
                    </div>
                    <div className="flex gap-1">
                      {user.roles.includes("teacher") && user.maktab && user.full_name && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEnterGhostMode(user)}
                          className="h-9 w-9 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          title="Sign in as this teacher"
                        >
                          <Ghost className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditUser(user)}
                        className="h-9 w-9"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setResetPasswordUserId(user.id)}
                        className="h-9 w-9"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteUserId(user.id)}
                        className="h-9 w-9"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {user.roles.length === 0 && !user.is_head_teacher ? (
                      <span className="text-muted-foreground text-xs">No roles</span>
                    ) : (
                      getRoleBadge(user)
                    )}
                    {user.maktab && (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.maktab === "boys" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-pink-100 text-pink-800"
                      }`}>
                        {user.maktab === "boys" ? "Boys" : "Girls"}
                      </span>
                    )}
                    {/* Group badges */}
                    {user.full_name && [...boysTeacherGroups, ...girlsTeacherGroups]
                      .filter(tg => tg.teacher_name === user.full_name)
                      .map((tg) => (
                        <span
                          key={`${tg.maktab}-${tg.group_code}`}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                        >
                          {tg.group_code}
                        </span>
                      ))
                    }
                    {user.must_change_password ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Maktab</TableHead>
                    <TableHead>Groups</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.full_name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles.length === 0 && !user.is_head_teacher ? (
                            <span className="text-muted-foreground text-sm">No roles</span>
                          ) : (
                            getRoleBadge(user)
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.maktab ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            user.maktab === "boys" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-pink-100 text-pink-800"
                          }`}>
                            {user.maktab === "boys" ? "Boys" : "Girls"}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.full_name && [...boysTeacherGroups, ...girlsTeacherGroups]
                            .filter(tg => tg.teacher_name === user.full_name)
                            .map((tg) => (
                              <span
                                key={`${tg.maktab}-${tg.group_code}`}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                              >
                                {tg.group_code}
                              </span>
                            ))
                          }
                          {!user.full_name || [...boysTeacherGroups, ...girlsTeacherGroups].filter(tg => tg.teacher_name === user.full_name).length === 0 ? (
                            <span className="text-muted-foreground">-</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.must_change_password ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.roles.includes("teacher") && user.maktab && user.full_name && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEnterGhostMode(user)}
                              title="Sign in as this teacher"
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            >
                              <Ghost className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            title="Edit user"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetPasswordUserId(user.id)}
                            title="Reset password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteUserId(user.id)}
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone and will remove all their data from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!resetPasswordUserId} onOpenChange={() => {
        setResetPasswordUserId(null);
        setNewPassword("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>
              Enter a new password for this user. The password must be at least 6 characters long.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setResetPasswordUserId(null);
              setNewPassword("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword || !newPassword}>
              {resettingPassword ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-full-name">Full Name</Label>
              <Input
                id="edit-full-name"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email (for notifications)</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="teacher@example.com"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for payment notifications (required for Head Teachers)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role-type">Role Type</Label>
              <Select value={editRoleType} onValueChange={(value: RoleType) => setEditRoleType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="head_teacher">Head Teacher (Admin + Teacher)</SelectItem>
                </SelectContent>
              </Select>
              {editRoleType === "head_teacher" && (
                <p className="text-xs text-muted-foreground">
                  Head Teacher has both admin and teacher privileges. Only one per maktab allowed.
                </p>
              )}
            </div>
            {editNeedsMaktab && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-maktab">Maktab</Label>
                  <Select 
                    value={editMaktab || ""} 
                    onValueChange={(value: "boys" | "girls") => {
                      setEditMaktab(value);
                      setEditGroups([]); // Reset groups when maktab changes
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select maktab" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="girls">Girls Maktab</SelectItem>
                      <SelectItem value="boys">Boys Maktab</SelectItem>
                    </SelectContent>
                  </Select>
                  {editExistingHeadTeacherWarning && (
                    <p className="text-xs text-destructive font-medium">
                      ⚠️ {editExistingHeadTeacherWarning.full_name} is already the head teacher for {editMaktab === "boys" ? "Boys" : "Girls"} Maktab
                    </p>
                  )}
                </div>
                {editMaktab && (
                  <div className="space-y-2">
                    <Label>Assigned Groups</Label>
                    <div className="flex flex-wrap gap-3">
                      {getGroupCodesForMaktab(editMaktab).map((code) => (
                        <label key={code} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editGroups.includes(code as GroupCode)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditGroups([...editGroups, code as GroupCode]);
                              } else {
                                setEditGroups(editGroups.filter(g => g !== code));
                              }
                            }}
                            className="rounded border-input h-5 w-5"
                          />
                          <span className="text-sm">{getGroupLabel(code)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={savingUser || !!editExistingHeadTeacherWarning}>
              {savingUser ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
