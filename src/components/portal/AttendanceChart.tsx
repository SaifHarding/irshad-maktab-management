import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, parseISO, isWithinInterval, getDay } from "date-fns";
import { Star } from "lucide-react";

// Helper to check if a day is a weekend (Friday=5, Saturday=6, Sunday=0)
const isWeekend = (date: Date) => {
  const day = getDay(date);
  return day === 0 || day === 5 || day === 6;
};

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  student_id: string;
  teacher_name: string;
}

interface AttendanceChartProps {
  attendance: AttendanceRecord[] | undefined;
  isLoading?: boolean;
}

type TimeframeOption = "7days" | "30days" | "3months" | "6months" | "12months";

export function AttendanceChart({ attendance, isLoading }: AttendanceChartProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>("30days");

  const chartData = useMemo(() => {
    if (!attendance || attendance.length === 0) return [];

    const now = new Date();
    let startDate: Date;
    let groupBy: "day" | "week" | "month";

    switch (timeframe) {
      case "7days":
        startDate = subDays(now, 7);
        groupBy = "day";
        break;
      case "30days":
        startDate = subDays(now, 30);
        groupBy = "day";
        break;
      case "3months":
        startDate = subMonths(now, 3);
        groupBy = "week";
        break;
      case "6months":
        startDate = subMonths(now, 6);
        groupBy = "week";
        break;
      case "12months":
        startDate = subMonths(now, 12);
        groupBy = "month";
        break;
      default:
        startDate = subDays(now, 30);
        groupBy = "day";
    }

    const filteredAttendance = attendance.filter(
      (a) => new Date(a.date) >= startDate && new Date(a.date) <= now
    );

    if (groupBy === "day") {
      const days = eachDayOfInterval({ start: startDate, end: now }).filter(day => !isWeekend(day));
      return days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayRecords = filteredAttendance.filter((a) => a.date === dayStr);
        const present = dayRecords.filter(
          (a) => a.status === "present" || a.status === "attended"
        ).length;
        const absent = dayRecords.filter((a) => a.status === "absent").length;
        const excused = dayRecords.filter((a) => a.status === "excused").length;

        return {
          label: format(day, timeframe === "7days" ? "EEE" : "d MMM"),
          date: dayStr,
          present,
          absent,
          excused,
          total: dayRecords.length,
          rate: dayRecords.length > 0 ? Math.round((present / dayRecords.length) * 100) : null,
        };
      });
    } else if (groupBy === "week") {
      const weeks = eachWeekOfInterval({ start: startDate, end: now }, { weekStartsOn: 1 });
      return weeks.map((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekRecords = filteredAttendance.filter((a) => {
          const recordDate = parseISO(a.date);
          // Exclude weekend days from weekly data
          if (isWeekend(recordDate)) return false;
          return isWithinInterval(recordDate, { start: weekStart, end: weekEnd });
        });
        const present = weekRecords.filter(
          (a) => a.status === "present" || a.status === "attended"
        ).length;
        const absent = weekRecords.filter((a) => a.status === "absent").length;
        const excused = weekRecords.filter((a) => a.status === "excused").length;

        return {
          label: format(weekStart, "d MMM"),
          date: format(weekStart, "yyyy-MM-dd"),
          present,
          absent,
          excused,
          total: weekRecords.length,
          rate: weekRecords.length > 0 ? Math.round((present / weekRecords.length) * 100) : null,
        };
      });
    } else {
      // Monthly grouping
      const months = eachMonthOfInterval({ start: startDate, end: now });
      return months.map((monthStart) => {
        const monthEnd = endOfMonth(monthStart);
        const monthRecords = filteredAttendance.filter((a) => {
          const recordDate = parseISO(a.date);
          if (isWeekend(recordDate)) return false;
          return isWithinInterval(recordDate, { start: monthStart, end: monthEnd });
        });
        const present = monthRecords.filter(
          (a) => a.status === "present" || a.status === "attended"
        ).length;
        const absent = monthRecords.filter((a) => a.status === "absent").length;
        const excused = monthRecords.filter((a) => a.status === "excused").length;

        return {
          label: format(monthStart, "MMM"),
          date: format(monthStart, "yyyy-MM"),
          present,
          absent,
          excused,
          total: monthRecords.length,
          rate: monthRecords.length > 0 ? Math.round((present / monthRecords.length) * 100) : null,
        };
      });
    }
  }, [attendance, timeframe]);

  const overallRate = useMemo(() => {
    const recordsWithData = chartData.filter((d) => d.total > 0);
    if (recordsWithData.length === 0) return 0;
    const totalPresent = recordsWithData.reduce((sum, d) => sum + d.present, 0);
    const totalRecords = recordsWithData.reduce((sum, d) => sum + d.total, 0);
    return totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
  }, [chartData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-[200px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-medium">Attendance Overview</CardTitle>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as TimeframeOption)}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="12months">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          Overall: <span className="font-semibold text-foreground">{overallRate}%</span> attendance
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 || chartData.every((d) => d.total === 0) ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            No attendance data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                interval={timeframe === "30days" ? 3 : timeframe === "7days" ? 0 : timeframe === "12months" ? 0 : "preserveStartEnd"}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isPerfect = data.rate === 100 && data.total > 0;
                    const isLongView = timeframe === "3months" || timeframe === "6months" || timeframe === "12months";
                    return (
                      <div className={`bg-popover border border-border rounded-lg shadow-lg p-3 text-sm ${isPerfect && isLongView ? 'ring-2 ring-yellow-500/50' : ''}`}>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{data.label}</p>
                          {isPerfect && isLongView && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <p className="text-muted-foreground">
                          Rate: <span className={`font-medium ${isPerfect ? 'text-yellow-600' : 'text-foreground'}`}>{data.rate ?? 0}%</span>
                          {isPerfect && isLongView && <span className="ml-1 text-yellow-600">Perfect!</span>}
                        </p>
                        <div className="mt-1 text-xs space-y-0.5">
                          <p className="text-green-600">Present: {data.present}</p>
                          <p className="text-red-600">Absent: {data.absent}</p>
                          <p className="text-yellow-600">Excused: {data.excused}</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="rate" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
