import type { BusinessHoursIntervals } from "@chatbotx.io/database/partials"
import type { useTranslations } from "next-intl"

type Translate = ReturnType<typeof useTranslations>

const MAX_LINES = 3

const SHORT_DAY_KEYS = {
  0: "businessHours.weekdaysShort.0",
  1: "businessHours.weekdaysShort.1",
  2: "businessHours.weekdaysShort.2",
  3: "businessHours.weekdaysShort.3",
  4: "businessHours.weekdaysShort.4",
  5: "businessHours.weekdaysShort.5",
  6: "businessHours.weekdaysShort.6",
} as Record<number, string>

function minutesToHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

const displayOrder = (weekday: number): number => (weekday + 6) % 7

/**
 * One readable line per distinct time range, e.g. `Lun–Vie 09:00–20:00`.
 * Days sharing the same range collapse into consecutive runs; capped at
 * MAX_LINES with a "+N more" overflow line.
 */
export function summarizeIntervals(
  intervals: BusinessHoursIntervals,
  t: Translate,
): string[] {
  const groups = new Map<
    string,
    { startMinute: number; endMinute: number; days: number[] }
  >()
  for (const interval of intervals) {
    const key = `${interval.startMinute}-${interval.endMinute}`
    const group = groups.get(key) ?? {
      startMinute: interval.startMinute,
      endMinute: interval.endMinute,
      days: [],
    }
    for (let day = 0; day < 7; day++) {
      if (interval.days[day] === true && !group.days.includes(day)) {
        group.days.push(day)
      }
    }
    groups.set(key, group)
  }

  const lines: string[] = []
  for (const group of groups.values()) {
    if (group.days.length === 0) {
      continue
    }
    const days = [...group.days].sort(
      (a, b) => displayOrder(a) - displayOrder(b),
    )
    const runs: number[][] = []
    for (const day of days) {
      const lastRun = runs.at(-1)
      const lastDay = lastRun?.at(-1)
      if (
        lastRun &&
        lastDay !== undefined &&
        displayOrder(day) === displayOrder(lastDay) + 1
      ) {
        lastRun.push(day)
      } else {
        runs.push([day])
      }
    }
    const dayPart = runs
      .map((run) => {
        const first = run.at(0)
        const last = run.at(-1)
        if (first === undefined || last === undefined) {
          return ""
        }
        return first === last
          ? t(SHORT_DAY_KEYS[first])
          : `${t(SHORT_DAY_KEYS[first])}–${t(SHORT_DAY_KEYS[last])}`
      })
      .join(", ")
    lines.push(
      `${dayPart} ${minutesToHHMM(group.startMinute)}–${minutesToHHMM(group.endMinute)}`,
    )
  }

  if (lines.length <= MAX_LINES) {
    return lines
  }
  return [
    ...lines.slice(0, MAX_LINES),
    t("businessHours.moreIntervals", { count: lines.length - MAX_LINES }),
  ]
}
