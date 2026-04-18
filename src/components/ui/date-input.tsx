"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type DateInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  placeholder?: string;
};

export function DateInput({
  className,
  value,
  placeholder = "dd/mm/yyyy",
  onFocus,
  onBlur,
  ...props
}: DateInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pickerMode, setPickerMode] = React.useState(Boolean(value));

  const openPicker = React.useCallback(() => {
    setPickerMode(true);

    window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;

      input.focus();

      if (typeof input.showPicker === "function") {
        try {
          input.showPicker();
        } catch {
          // Some browsers throw when picker cannot be shown programmatically.
        }
      }
    });
  }, []);

  React.useEffect(() => {
    if (value) {
      setPickerMode(true);
      return;
    }

    if (document.activeElement !== inputRef.current) {
      setPickerMode(false);
    }
  }, [value]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type={pickerMode || Boolean(value) ? "date" : "text"}
        value={value}
        placeholder={!pickerMode && !value ? placeholder : undefined}
        inputMode={!pickerMode && !value ? "numeric" : undefined}
        onFocus={(event) => {
          onFocus?.(event);

          if (!pickerMode && !value) {
            openPicker();
          }
        }}
        onClick={() => {
          if (!pickerMode && !value) {
            openPicker();
            return;
          }

          const input = inputRef.current;
          if (typeof input?.showPicker === "function") {
            try {
              input.showPicker();
            } catch {
              // Ignore unsupported picker interactions.
            }
          }
        }}
        onBlur={(event) => {
          onBlur?.(event);

          if (!event.currentTarget.value) {
            setPickerMode(false);
          }
        }}
        className={cn("pl-9", className)}
        {...props}
      />
      <CalendarDays
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}