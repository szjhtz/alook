"use client";

import { cn } from "@/lib/utils";

export type CalendarView = "month" | "agenda";

export function parseCalendarView(raw: string | null | undefined): CalendarView {
  return raw === "agenda" ? "agenda" : "month";
}

export interface CalendarViewSwitcherProps {
  view: CalendarView;
  onChange: (view: CalendarView) => void;
}

export function CalendarViewSwitcher({ view, onChange }: CalendarViewSwitcherProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Calendar view"
      className="inline-flex items-center rounded-md border border-border bg-background p-0.5"
    >
      {(["month", "agenda"] as const).map((v) => {
        const active = view === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              "h-6 px-2.5 rounded text-xs font-medium transition-colors capitalize",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}
