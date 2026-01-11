import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAllStudentsDirectory } from "@/hooks/useStudentDetails";
import { StudentDetailSheet } from "@/components/admin/StudentDetailSheet";
import { Home, Search, Users, ArrowLeft, ChevronRight, CreditCard } from "lucide-react";
import AddStudentDialog from "@/components/admin/AddStudentDialog";
import { differenceInYears, parseISO } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { paths } from "@/lib/portalPaths";

const calculateAge = (dateOfBirth: string | null): number | null => {
  if (!dateOfBirth) return null;
  try {
    const dob = parseISO(dateOfBirth);
    return differenceInYears(new Date(), dob);
  } catch {
    return null;
  }
};

const StudentDirectory = () => {
  const [maktabFilter, setMaktabFilter] = useState<"boys" | "girls" | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const { students, isLoading } = useAllStudentsDirectory(maktabFilter, statusFilter);

  const filteredStudents = students.filter(student => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      student.name?.toLowerCase().includes(query) ||
      student.student_code?.toLowerCase().includes(query) ||
      student.guardian_name?.toLowerCase().includes(query)
    );
  });

  const handleStudentClick = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSheetOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 safe-top safe-bottom">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to={paths.admin()}>
                <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
              <h1 className="text-xl sm:text-3xl font-bold">Students</h1>
            </div>
            <div className="flex items-center gap-2">
              <AddStudentDialog defaultMaktab={maktabFilter} />
              <Link to={paths.home()}>
                <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
                  <Home className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Home</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              All Students
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Tap a student to view and edit details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
            {/* Search and Filters */}
            <div className="space-y-2 sm:space-y-0 sm:flex sm:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 sm:h-10"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={maktabFilter || "all"}
                  onValueChange={(value) => setMaktabFilter(value === "all" ? undefined : value as "boys" | "girls")}
                >
                  <SelectTrigger className="w-full sm:w-[120px] h-9 sm:h-10">
                    <SelectValue placeholder="Maktab" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="boys">Boys</SelectItem>
                    <SelectItem value="girls">Girls</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9 sm:h-10">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending_payment">Pending Payment</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Count */}
            <div className="text-xs sm:text-sm text-muted-foreground">
              {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No students found
              </div>
            ) : isMobile ? (
              /* Mobile Card View */
              <div className="space-y-2">
                {filteredStudents.map((student) => {
                  const age = calculateAge(student.date_of_birth);
                  return (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 p-3 border rounded-lg bg-card active:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleStudentClick(student.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{student.name}</span>
                          <Badge 
                            variant={student.status === "active" ? "default" : student.status === "pending_payment" ? "outline" : "secondary"} 
                            className={`text-[10px] px-1.5 py-0 ${student.status === "pending_payment" ? "border-amber-500 text-amber-600" : ""}`}
                          >
                            {student.status === "pending_payment" ? "Pending" : student.status || "active"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="font-mono">{student.student_code || "-"}</span>
                          <span>•</span>
                          <span>{student.maktab === "boys" ? "Boys" : "Girls"}</span>
                          {student.student_group && (
                            <>
                              <span>•</span>
                              <span>Group {student.student_group}</span>
                            </>
                          )}
                          {age !== null && (
                            <>
                              <span>•</span>
                              <span>{age}y</span>
                            </>
                          )}
                        </div>
                        {student.stripe_customer_id && (
                          <div className="flex items-center gap-1 mt-1">
                            <CreditCard className="h-3 w-3 text-primary" />
                            <span className="text-[10px] text-primary">Stripe Active</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Desktop Table View */
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Maktab</TableHead>
                      <TableHead className="hidden md:table-cell">Group</TableHead>
                      <TableHead className="hidden lg:table-cell">Age</TableHead>
                      <TableHead className="hidden lg:table-cell">Stripe</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const age = calculateAge(student.date_of_birth);
                      return (
                        <TableRow
                          key={student.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleStudentClick(student.id)}
                        >
                          <TableCell className="font-mono text-sm">
                            {student.student_code || "-"}
                          </TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline">
                              {student.maktab === "boys" ? "Boys" : "Girls"}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {student.student_group || "-"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {age !== null ? `${age} yrs` : "-"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant={student.stripe_customer_id ? "default" : "secondary"}>
                              {student.stripe_customer_id ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={student.status === "active" ? "default" : student.status === "pending_payment" ? "outline" : "secondary"}
                              className={student.status === "pending_payment" ? "border-amber-500 text-amber-600" : ""}
                            >
                              {student.status === "pending_payment" ? "Pending Payment" : student.status || "active"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Student Detail Sheet */}
      <StudentDetailSheet
        studentId={selectedStudentId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
};

export default StudentDirectory;