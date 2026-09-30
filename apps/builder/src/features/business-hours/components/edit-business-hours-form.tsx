"use client"

import type {
  BusinessHoursHolidays,
  BusinessHoursIntervals,
} from "@chatbotx.io/database/partials"
import { InputField } from "@chatbotx.io/ui/components/form/input-field"
import { SwitchField } from "@chatbotx.io/ui/components/form/switch-field"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import { Calendar } from "@chatbotx.io/ui/components/ui/calendar"
import { Checkbox } from "@chatbotx.io/ui/components/ui/checkbox"
import { Form } from "@chatbotx.io/ui/components/ui/form"
import { Input } from "@chatbotx.io/ui/components/ui/input"
import { Label } from "@chatbotx.io/ui/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@chatbotx.io/ui/components/ui/popover"
import { zodResolver } from "@hookform/resolvers/zod"
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks"
import { CalendarIcon, PlusIcon, TrashIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useFieldArray } from "react-hook-form"
import { toast } from "sonner"
import { updateBusinessHoursAction } from "../actions/update-business-hours.action"
import { updateBusinessHoursRequest } from "../schema/action"

const TIME_STEP_MINUTES = 15
const DAY_END_MINUTE = 23 * 60 + 59
const MAX_INTERVALS = 28

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

const WEEKDAY_LABEL_KEYS = {
  0: "businessHours.weekdays.0",
  1: "businessHours.weekdays.1",
  2: "businessHours.weekdays.2",
  3: "businessHours.weekdays.3",
  4: "businessHours.weekdays.4",
  5: "businessHours.weekdays.5",
  6: "businessHours.weekdays.6",
} as const satisfies Record<number, string>

function minutesToTimeLabel(minutes: number): string {
  const clamped = Math.min(Math.max(minutes, 0), DAY_END_MINUTE)
  const hours = Math.floor(clamped / 60)
  const mins = clamped % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

const HHMM_PATTERN = /^(\d{2}):(\d{2})/

function parseHHMM(value: string): number | null {
  const match = HHMM_PATTERN.exec(value.trim())
  if (!match) {
    return null
  }
  const minutes = Number(match[1]) * 60 + Number(match[2])
  if (minutes < 0 || minutes > DAY_END_MINUTE) {
    return null
  }
  // Snap manual typing to the 15-minute grid (the picker arrows already step by 15).
  return Math.floor(minutes / TIME_STEP_MINUTES) * TIME_STEP_MINUTES
}

function isoToDisplay(iso: string): string {
  const [year, month, day] = iso.split("-")
  return `${day}-${month}-${year}`
}

function dateToIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function dateToDisplay(date: Date): string {
  const [year, month, day] = dateToIso(date).split("-")
  return `${day}-${month}-${year}`
}

export type BusinessHoursScheduleForEdit = {
  id: string
  name: string
  active: boolean
  intervals: BusinessHoursIntervals
  holidays: BusinessHoursHolidays
}

export function EditBusinessHoursForm({
  workspaceId,
  workspaceTimezone,
  schedule,
}: {
  workspaceId: string
  workspaceTimezone: string
  schedule: BusinessHoursScheduleForEdit
}) {
  const t = useTranslations()
  const router = useRouter()
  const [holidayDraft, setHolidayDraft] = useState<Date | undefined>()
  const [holidayPickerOpen, setHolidayPickerOpen] = useState(false)

  const { form, handleSubmitWithAction } = useHookFormAction(
    updateBusinessHoursAction.bind(null, workspaceId, schedule.id),
    zodResolver(updateBusinessHoursRequest),
    {
      actionProps: {
        onSuccess: () => {
          toast.success(
            t("messages.updatedSuccess", {
              feature: t("businessHours.singular"),
            }),
          )
          router.push(`/space/${workspaceId}/business-hours`)
        },
        onError: ({ error }) => {
          if (error.serverError) {
            toast.error(error.serverError)
          }
        },
      },
      formProps: {
        mode: "onChange",
        defaultValues: {
          name: schedule.name,
          active: schedule.active,
          intervals: schedule.intervals,
          holidays: schedule.holidays,
        },
      },
    },
  )

  const {
    fields: intervalFields,
    append: appendInterval,
    remove: removeInterval,
    update: updateInterval,
  } = useFieldArray({ control: form.control, name: "intervals" })

  const commitInterval = (
    index: number,
    value: { startMinute: number; endMinute: number; days: boolean[] },
  ) => {
    updateInterval(index, value)
    form.trigger("intervals").catch(() => undefined)
  }
  const holidaysValue = form.watch("holidays") ?? []

  const appendHoliday = (iso: string) => {
    form.setValue("holidays", [...holidaysValue, iso], {
      shouldValidate: true,
      shouldDirty: true,
    })
  }

  const removeHoliday = (iso: string) => {
    form.setValue(
      "holidays",
      holidaysValue.filter((holiday) => holiday !== iso),
      { shouldValidate: true, shouldDirty: true },
    )
  }

  const toggleDay = (index: number, weekday: number, checked: boolean) => {
    const current = form.getValues(`intervals.${index}`)
    if (!current) {
      return
    }
    commitInterval(index, {
      ...current,
      days: current.days.map((active, day) =>
        day === weekday ? checked : active,
      ),
    })
  }

  const handleAddHoliday = () => {
    if (!holidayDraft) {
      return
    }
    const iso = dateToIso(holidayDraft)
    if (holidaysValue.includes(iso)) {
      toast.error(t("businessHours.invalidHoliday"))
      return
    }
    appendHoliday(iso)
    setHolidayDraft(undefined)
    setHolidayPickerOpen(false)
    form.trigger("holidays").catch(() => undefined)
  }

  return (
    <Form {...form}>
      <form
        className="flex max-w-3xl flex-col gap-6"
        onSubmit={handleSubmitWithAction}
      >
        <InputField
          label={t("businessHours.name")}
          maxLength={255}
          name="name"
          required
        />

        <p className="text-muted-foreground text-sm">
          {t("businessHours.workspaceTimezoneNote", {
            timezone: workspaceTimezone,
          })}
        </p>

        <SwitchField
          description={t("businessHours.activeDescription")}
          label={t("businessHours.active")}
          name="active"
        />

        <div className="flex flex-col gap-4">
          <div className="font-medium text-sm">
            {t("businessHours.intervals")}
          </div>
          {intervalFields.map((field, index) => (
            <div className="flex flex-col gap-2 border-b pb-4" key={field.id}>
              <div className="flex items-center gap-2">
                <Input
                  aria-label={t("businessHours.startTime")}
                  max="23:45"
                  min="00:00"
                  onChange={(event) => {
                    const startMinute = parseHHMM(event.target.value)
                    if (startMinute == null) {
                      return
                    }
                    const endMinute =
                      startMinute === field.endMinute
                        ? Math.min(
                            startMinute + TIME_STEP_MINUTES,
                            DAY_END_MINUTE,
                          )
                        : field.endMinute
                    commitInterval(index, {
                      startMinute,
                      endMinute,
                      days: field.days,
                    })
                  }}
                  step={TIME_STEP_MINUTES * 60}
                  type="time"
                  value={minutesToTimeLabel(field.startMinute)}
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  aria-label={t("businessHours.endTime")}
                  max="23:59"
                  min="00:15"
                  onChange={(event) => {
                    const endMinute = parseHHMM(event.target.value)
                    if (endMinute == null) {
                      return
                    }
                    commitInterval(index, {
                      startMinute: field.startMinute,
                      endMinute,
                      days: field.days,
                    })
                  }}
                  step={TIME_STEP_MINUTES * 60}
                  type="time"
                  value={minutesToTimeLabel(field.endMinute)}
                />
                <Button
                  onClick={() => removeInterval(index)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <TrashIcon className="size-4 text-destructive" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {WEEKDAY_ORDER.map((weekday) => (
                  <div className="flex items-center gap-1.5" key={weekday}>
                    <Checkbox
                      checked={field.days?.[weekday] === true}
                      id={`interval-${field.id}-day-${weekday}`}
                      onCheckedChange={(checked) =>
                        toggleDay(index, weekday, checked === true)
                      }
                    />
                    <Label
                      className="cursor-pointer text-xs"
                      htmlFor={`interval-${field.id}-day-${weekday}`}
                    >
                      {t(WEEKDAY_LABEL_KEYS[weekday])}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {intervalFields.length < MAX_INTERVALS && (
            <div>
              <Button
                onClick={() =>
                  appendInterval({
                    startMinute: 9 * 60,
                    endMinute: 17 * 60,
                    days: [false, true, true, true, true, true, false],
                  })
                }
                size="sm"
                type="button"
                variant="outline"
              >
                <PlusIcon className="me-1 size-4" />
                {t("businessHours.addInterval")}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="font-medium text-sm">
            {t("businessHours.holidays")}
          </div>
          <p className="text-muted-foreground text-xs">
            {t("businessHours.holidaysHint")}
          </p>
          {holidaysValue.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {holidaysValue.map((iso) => (
                <div
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
                  key={iso}
                >
                  <span>{isoToDisplay(iso)}</span>
                  <Button
                    className="h-auto p-1"
                    onClick={() => removeHoliday(iso)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <TrashIcon className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex max-w-md flex-wrap items-center gap-2">
            <Popover
              onOpenChange={setHolidayPickerOpen}
              open={holidayPickerOpen}
            >
              <PopoverTrigger
                nativeButton={false}
                render={
                  <button
                    className="flex h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-xs"
                    type="button"
                  >
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    {holidayDraft
                      ? dateToDisplay(holidayDraft)
                      : t("businessHours.pickHolidayDate")}
                  </button>
                }
              />
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  onSelect={(day) => {
                    setHolidayDraft(day ?? undefined)
                  }}
                  selected={holidayDraft}
                />
              </PopoverContent>
            </Popover>
            <Button
              disabled={!holidayDraft}
              onClick={handleAddHoliday}
              size="sm"
              type="button"
            >
              <PlusIcon className="me-1 size-4" />
              {t("businessHours.addHoliday")}
            </Button>
          </div>
        </div>

        <div>
          <Button
            disabled={!form.formState.isValid || form.formState.isSubmitting}
            size="sm"
            type="submit"
          >
            {t("actions.save")}
          </Button>
        </div>
      </form>
    </Form>
  )
}
