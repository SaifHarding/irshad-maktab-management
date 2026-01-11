import { Link } from "react-router-dom";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  UserPlus,
  UserCog,
  Calendar,
  Bell,
  Mail,
  FileText,
  BookOpen,
  GraduationCap,
  Megaphone,
  TestTube2,
  Layers,
} from "lucide-react";
import { paths } from "@/lib/portalPaths";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface QuickAction {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  bgColor: string;
}

interface ActionCategory {
  label: string;
  actions: QuickAction[];
}

const actionCategories: ActionCategory[] = [
  {
    label: "Users & Students",
    actions: [
      {
        title: "New Registrations",
        description: "Review and approve student registration submissions",
        icon: UserPlus,
        href: paths.adminRegistrations(),
        color: "text-amber-600",
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
      },
      {
        title: "User Management",
        description: "Create, edit and manage teacher & admin accounts",
        icon: UserCog,
        href: paths.adminUsers(),
        color: "text-blue-600",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
      },
      {
        title: "Student Directory",
        description: "View and manage all students across both maktabs",
        icon: Users,
        href: paths.adminStudents(),
        color: "text-emerald-600",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
      },
      {
        title: "Maktab Classes",
        description: "Manage class groups and sub-groups (A1, A2, B1, etc.)",
        icon: Layers,
        href: paths.adminClasses(),
        color: "text-violet-600",
        bgColor: "bg-violet-100 dark:bg-violet-900/30",
      },
    ],
  },
  {
    label: "Communication",
    actions: [
      {
        title: "Announcements",
        description: "Send emails and notifications to parents",
        icon: Megaphone,
        href: paths.adminAnnouncements(),
        color: "text-orange-600",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
      },
      {
        title: "Notifications",
        description: "Configure reminder settings and mute periods",
        icon: Bell,
        href: paths.adminNotifications(),
        color: "text-purple-600",
        bgColor: "bg-purple-100 dark:bg-purple-900/30",
      },
      {
        title: "Portal Management",
        description: "Manage parent portal registrations and invites",
        icon: Mail,
        href: paths.adminPortal(),
        color: "text-pink-600",
        bgColor: "bg-pink-100 dark:bg-pink-900/30",
      },
      {
        title: "Email Testing",
        description: "Test and preview emails before sending",
        icon: TestTube2,
        href: paths.adminEmailTesting(),
        color: "text-cyan-600",
        bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
      },
    ],
  },
  {
    label: "Records & Logs",
    actions: [
      {
        title: "Teacher Attendance",
        description: "Track and review teacher attendance records",
        icon: Calendar,
        href: paths.adminTeacherAttendance(),
        color: "text-amber-600",
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
      },
      {
        title: "Audit Logs",
        description: "View system activity and change history",
        icon: FileText,
        href: paths.auditLogs(),
        color: "text-slate-600",
        bgColor: "bg-slate-100 dark:bg-slate-800/50",
      },
    ],
  },
  {
    label: "Maktabs",
    actions: [
      {
        title: "Boys Maktab",
        description: "Access attendance and student management",
        icon: GraduationCap,
        href: paths.maktab("boys"),
        color: "text-green-600",
        bgColor: "bg-green-100 dark:bg-green-900/30",
      },
      {
        title: "Girls Maktab",
        description: "Access attendance and student management",
        icon: BookOpen,
        href: paths.maktab("girls"),
        color: "text-rose-600",
        bgColor: "bg-rose-100 dark:bg-rose-900/30",
      },
    ],
  },
];

export function AdminQuickActions() {
  return (
    <div className="space-y-6">
      {actionCategories.map((category, categoryIndex) => (
        <div key={category.label}>
          {categoryIndex > 0 && <Separator className="mb-6" />}
          <div className="mb-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {category.label}
            </h3>
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {category.actions.map((action) => {
              const Icon = action.icon;

              const cardContent = (
                <Card
                  className={cn(
                    "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 border-transparent hover:border-primary/20",
                    "h-full"
                  )}
                >
                  <CardHeader className="p-3 sm:p-4 lg:p-5">
                    <div
                      className={cn(
                        "w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-3 transition-transform group-hover:scale-110",
                        action.bgColor
                      )}
                    >
                      <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6", action.color)} />
                    </div>
                    <CardTitle className="text-sm sm:text-base font-semibold leading-tight">
                      {action.title}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm line-clamp-2 mt-0.5 sm:mt-1">
                      {action.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );

              return (
                <Link key={action.title} to={action.href} className="focus:outline-none">
                  {cardContent}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
