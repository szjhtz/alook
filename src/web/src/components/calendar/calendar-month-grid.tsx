"use client";

import { cn } from "@/lib/utils";
import type { CalendarEvent, Agent } from "@alook/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarDayPopover } from "./calendar-day-popover";
import { CalendarDatePicker } from "./calendar-date-picker";

function agentColor(agentId: string): string {
  // Deterministic warm palette derived from the agent id.
  const palette = [
    "bg-[oklch(0.78_0.08_60)] text-[oklch(0.25_0.05_60)]",
    "bg-[oklch(0.80_0.07_120)] text-[oklch(0.25_0.05_120)]",
    "bg-[oklch(0.80_0.06_220)] text-[oklch(0.25_0.05_220)]",
    "bg-[oklch(0.80_0.07_30)] text-[oklch(0.25_0.05_30)]",
    "bg-[oklch(0.80_0.06_280)] text-[oklch(0.25_0.05_280)]",
    "bg-[oklch(0.80_0.07_160)] text-[oklch(0.25_0.05_160)]",
  ];
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length]!;
}

// Tailwind v4 JIT only picks up classes that appear literally in source —
// so each palette entry must be a fully-enumerated class string.
function agentChipOutline(agentId: string): string {
  const palette = [
    "border-[oklch(0.55_0.12_60)] text-[oklch(0.35_0.09_60)] bg-transparent hover:bg-[oklch(0.95_0.03_60)] dark:text-[oklch(0.82_0.08_60)] dark:hover:bg-[oklch(0.25_0.03_60)]",
    "border-[oklch(0.55_0.11_120)] text-[oklch(0.35_0.09_120)] bg-transparent hover:bg-[oklch(0.95_0.03_120)] dark:text-[oklch(0.82_0.08_120)] dark:hover:bg-[oklch(0.25_0.03_120)]",
    "border-[oklch(0.55_0.11_220)] text-[oklch(0.35_0.09_220)] bg-transparent hover:bg-[oklch(0.95_0.03_220)] dark:text-[oklch(0.82_0.08_220)] dark:hover:bg-[oklch(0.25_0.03_220)]",
    "border-[oklch(0.55_0.12_30)] text-[oklch(0.35_0.09_30)] bg-transparent hover:bg-[oklch(0.95_0.03_30)] dark:text-[oklch(0.82_0.08_30)] dark:hover:bg-[oklch(0.25_0.03_30)]",
    "border-[oklch(0.55_0.11_280)] text-[oklch(0.35_0.09_280)] bg-transparent hover:bg-[oklch(0.95_0.03_280)] dark:text-[oklch(0.82_0.08_280)] dark:hover:bg-[oklch(0.25_0.03_280)]",
    "border-[oklch(0.55_0.11_160)] text-[oklch(0.35_0.09_160)] bg-transparent hover:bg-[oklch(0.95_0.03_160)] dark:text-[oklch(0.82_0.08_160)] dark:hover:bg-[oklch(0.25_0.03_160)]",
  ];
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length]!;
}

export function buildMonthCells(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - startDow + i);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }
  return cells;
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isTodayMonth(year: number, month: number, ref: Date = new Date()): boolean {
  return ref.getFullYear() === year && ref.getMonth() === month;
}

/** Returns the new focused date when the given keyboard key is pressed. */
export function stepDate(
  date: Date,
  key: string
): Date | null {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  switch (key) {
    case "ArrowLeft":
      d.setDate(d.getDate() - 1);
      return d;
    case "ArrowRight":
      d.setDate(d.getDate() + 1);
      return d;
    case "ArrowUp":
      d.setDate(d.getDate() - 7);
      return d;
    case "ArrowDown":
      d.setDate(d.getDate() + 7);
      return d;
    case "Home":
      d.setDate(d.getDate() - d.getDay()); // snap to Sunday
      return d;
    case "End":
      d.setDate(d.getDate() + (6 - d.getDay())); // snap to Saturday
      return d;
    case "PageUp": {
      const targetYear = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
      const targetMonth = (d.getMonth() - 1 + 12) % 12;
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      d.setFullYear(targetYear, targetMonth, Math.min(d.getDate(), lastDay));
      return d;
    }
    case "PageDown": {
      const targetYear = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
      const targetMonth = (d.getMonth() + 1) % 12;
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      d.setFullYear(targetYear, targetMonth, Math.min(d.getDate(), lastDay));
      return d;
    }
    default:
      return null;
  }
}

export interface CalendarMonthGridProps {
  year: number;
  month: number; // 0-indexed
  events: CalendarEvent[];
  agents: Agent[];
  loading: boolean;
  focusedDate: Date;
  openPopoverKey: string | null;
  onPopoverChange: (key: string | null) => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpToToday: () => void;
  onJumpToDate: (date: Date) => void;
  onSelectDay: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  headerExtras?: React.ReactNode;
}

export function CalendarMonthGrid({
  year,
  month,
  events,
  agents,
  loading,
  focusedDate,
  openPopoverKey,
  onPopoverChange,
  onPrev,
  onNext,
  onJumpToToday,
  onJumpToDate,
  onSelectDay,
  onSelectEvent,
  headerExtras,
}: CalendarMonthGridProps) {
  const cells = buildMonthCells(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = dateKey(new Date(ev.scheduled_at));
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(ev);
  }

  const agentNameById = new Map<string, string>();
  for (const a of agents) agentNameById.set(a.id, a.name);

  const today = new Date();
  const todayDisabled = isTodayMonth(year, month, today);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium tabular-nums">{monthLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          {headerExtras}
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={onPrev}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={onJumpToToday}
              disabled={todayDisabled}
              className="h-7 px-2.5 text-xs"
            >
              Today
            </Button>
            <button
              type="button"
              aria-label="Next month"
              onClick={onNext}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <CalendarDatePicker
            value={focusedDate}
            onChange={onJumpToDate}
            ariaLabel="Jump to date"
          />
        </div>
      </div>

      <div className="grid grid-cols-7 text-[11px] text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      <div className="relative">
        {loading && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden rounded-t-lg"
          >
            <div className="h-full w-1/3 animate-[calendar-progress_1.2s_ease-in-out_infinite] bg-foreground/40" />
          </div>
        )}
        <div
          role="grid"
          aria-label={`Calendar ${monthLabel}`}
          aria-busy={loading || undefined}
          className={cn(
            "grid grid-cols-7 gap-px rounded-lg border border-border/50 bg-border/40 overflow-hidden transition-opacity",
            loading && "opacity-70"
          )}
          data-testid="calendar-month-grid"
        >
        {cells.map((cell, i) => {
          const key = dateKey(cell.date);
          const dayEvents = eventsByDay.get(key) ?? [];
          const isToday = sameDay(today, cell.date);
          const isFocused = sameDay(focusedDate, cell.date);
          const hiddenCount = Math.max(0, dayEvents.length - 3);

          return (
            <div
              role="gridcell"
              key={i}
              data-date={key}
              data-focused={isFocused ? "true" : undefined}
              aria-current={isToday ? "date" : undefined}
              tabIndex={isFocused ? 0 : -1}
              onClick={() => onSelectDay(cell.date)}
              onKeyDown={(e) => {
                // Enter/Space on the cell opens the create dialog when no
                // popover trigger is present; the overflow popover owns Enter
                // if the day has hidden events (handled by the trigger itself).
                if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                  e.preventDefault();
                  onSelectDay(cell.date);
                }
              }}
              className={cn(
                "group flex min-h-24 flex-col gap-1 p-2 text-left transition-colors bg-background outline-none cursor-pointer",
                !cell.inMonth && "bg-muted/40 text-muted-foreground",
                isFocused &&
                  "ring-2 ring-inset ring-ring/60 relative z-10"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    isToday &&
                      "flex size-5 items-center justify-center rounded-full bg-foreground text-background font-medium"
                  )}
                >
                  {cell.date.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={`${ev.id}@${ev.occurrence_at}`}
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          onSelectEvent(ev);
                        }
                      }}
                      className={cn(
                        "border truncate rounded-sm px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                        agentChipOutline(ev.agent_id)
                      )}
                      title={`${ev.title}${
                        agentNameById.get(ev.agent_id)
                          ? ` — ${agentNameById.get(ev.agent_id)}`
                          : ""
                      }`}
                    >
                      {ev.title}
                    </span>
                  ))}
                  {hiddenCount > 0 && (
                    <CalendarDayPopover
                      date={cell.date}
                      hiddenCount={hiddenCount}
                      events={dayEvents}
                      agents={agents}
                      open={openPopoverKey === key}
                      onOpenChange={(o) => onPopoverChange(o ? key : null)}
                      onSelectEvent={onSelectEvent}
                    />
                  )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

export { agentColor, agentChipOutline };
