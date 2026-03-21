import { useState, useRef, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30; // 06:00 to 22:00
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const label = `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
  return { value, label };
});

function formatTimeToDisplay(value: string): string {
  const opt = TIME_OPTIONS.find((o) => o.value === value);
  return opt?.label || value;
}

function parseTimeInput(input: string): string | null {
  const cleaned = input.replace(/\s+/g, "").toUpperCase();

  // Try "H:MM AM/PM" or "HH:MM AM/PM"
  const ampmMatch = cleaned.match(/^(\d{1,2}):?(\d{2})?(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1]);
    const m = parseInt(ampmMatch[2] || "0");
    const period = ampmMatch[3];
    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      // Snap to nearest 30 min
      const snapped = Math.round(m / 30) * 30;
      const finalM = snapped === 60 ? 0 : snapped;
      const finalH = snapped === 60 ? h + 1 : h;
      return `${String(finalH).padStart(2, "0")}:${String(finalM).padStart(2, "0")}`;
    }
  }

  // Try "HH:MM" 24hr
  const milMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (milMatch) {
    const h = parseInt(milMatch[1]);
    const m = parseInt(milMatch[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      const snapped = Math.round(m / 30) * 30;
      const finalM = snapped === 60 ? 0 : snapped;
      const finalH = snapped === 60 ? h + 1 : h;
      return `${String(finalH).padStart(2, "0")}:${String(finalM).padStart(2, "0")}`;
    }
  }

  // Try bare digits like "9", "930", "14"
  const digitMatch = cleaned.match(/^(\d{1,4})$/);
  if (digitMatch) {
    const digits = digitMatch[1];
    let h: number, m: number;
    if (digits.length <= 2) {
      h = parseInt(digits);
      m = 0;
    } else {
      h = parseInt(digits.slice(0, -2));
      m = parseInt(digits.slice(-2));
    }
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      const snapped = Math.round(m / 30) * 30;
      const finalM = snapped === 60 ? 0 : snapped;
      const finalH = snapped === 60 ? h + 1 : h;
      return `${String(finalH).padStart(2, "0")}:${String(finalM).padStart(2, "0")}`;
    }
  }

  return null;
}

interface TimeInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function TimeInput({
  value,
  onValueChange,
  placeholder = "9:00 AM",
  disabled = false,
  className,
}: TimeInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(() => formatTimeToDisplay(value));
  const [filterText, setFilterText] = useState("");
  const activeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display when value prop changes externally
  useEffect(() => {
    if (!inputRef.current || document.activeElement !== inputRef.current) {
      setInputValue(formatTimeToDisplay(value));
    }
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!filterText) return TIME_OPTIONS;
    const q = filterText.toLowerCase();
    return TIME_OPTIONS.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.includes(q)
    );
  }, [filterText]);

  const handleInputChange = (text: string) => {
    setInputValue(text);
    setFilterText(text);
    if (!open) setOpen(true);
  };

  const handleInputBlur = () => {
    const parsed = parseTimeInput(inputValue);
    if (parsed) {
      onValueChange(parsed);
      setInputValue(formatTimeToDisplay(parsed));
    } else {
      // Reset to current value
      setInputValue(formatTimeToDisplay(value));
    }
    setFilterText("");
  };

  const handleSelect = (optValue: string) => {
    onValueChange(optValue);
    setInputValue(formatTimeToDisplay(optValue));
    setFilterText("");
    setOpen(false);
  };

  // Scroll active item into view
  useEffect(() => {
    if (open && activeRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "relative flex items-center w-full",
            className
          )}
        >
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              setInputValue("");
              setFilterText("");
              setOpen(true);
            }}
            onBlur={handleInputBlur}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-8"
          />
          <Clock className="absolute right-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[160px] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="h-[200px]">
          <div className="p-1">
            {filteredOptions.map((opt) => (
              <button
                key={opt.value}
                ref={opt.value === value ? activeRef : undefined}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm rounded-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  opt.value === value && "bg-accent text-accent-foreground font-medium"
                )}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before click
                  handleSelect(opt.value);
                }}
              >
                {opt.label}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No matching times
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export { TIME_OPTIONS };
