import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateRangePickerProps {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  selectedPreset: string;
  onPresetChange: (preset: string) => void;
}

export function DateRangePicker({ date, onDateChange, selectedPreset, onPresetChange }: DateRangePickerProps) {
  const handlePresetChange = (value: string) => {
    onPresetChange(value);
    const today = new Date();
    
    let newFrom: Date | undefined;
    let newTo: Date | undefined;
    
    switch (value) {
      case "7days":
        newFrom = subDays(today, 7);
        newTo = today;
        break;
      case "30days":
        newFrom = subDays(today, 30);
        newTo = today;
        break;
      case "60days":
        newFrom = subDays(today, 60);
        newTo = today;
        break;
      case "90days":
        newFrom = subDays(today, 90);
        newTo = today;
        break;
      case "all":
        newFrom = undefined;
        newTo = undefined;
        break;
      case "custom":
        // Keep existing date
        return;
    }
    
    if (value === "all") {
      onDateChange(undefined);
    } else {
      onDateChange({ from: newFrom, to: newTo });
    }
  };

  const getPresetLabel = (preset: string) => {
    switch (preset) {
      case "all": return "All Time";
      case "7days": return "7 Days";
      case "30days": return "30 Days";
      case "60days": return "60 Days";
      case "90days": return "90 Days";
      case "custom": return "Custom";
      default: return "Select period";
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue>{getPresetLabel(selectedPreset)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="7days">7 Days</SelectItem>
          <SelectItem value="30days">30 Days</SelectItem>
          <SelectItem value="60days">60 Days</SelectItem>
          <SelectItem value="90days">90 Days</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>

      {selectedPreset === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant="outline"
              className={cn(
                "w-full sm:w-[260px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "MMM d")} - {format(date.to, "MMM d")}
                  </>
                ) : (
                  format(date.from, "MMM d")
                )
              ) : (
                <span>Pick dates</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={onDateChange}
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
