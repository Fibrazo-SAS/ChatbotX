"use client"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { AppTab } from "@/components/app-tab"
import { isCommunity } from "@/env"
import { useWorkspaceId } from "@/hooks/routing"

const GENERAL_TAB_VALUE = "general"

export function SettingsTab({
  scheduledForDeletion = false,
}: {
  scheduledForDeletion?: boolean
}) {
  const t = useTranslations()
  const pathname = usePathname()

  const workspaceId = useWorkspaceId()

  const tabs = useMemo(
    () => [
      {
        label: t("general.title"),
        value: "general",
      },
      {
        label: t("channels.title"),
        value: "channels",
      },
      {
        label: t("integrations.title"),
        value: "integrations",
      },
      {
        label: t("admins.title"),
        value: "admins",
      },
      {
        label: t("inboxTeams.title"),
        value: "inbox-teams",
      },
      // {
      //   label: t("billing.title"),
      //   value: "billing",
      // },
      ...(isCommunity()
        ? []
        : [
            {
              label: t("auditLogs.title"),
              value: "audit-logs",
            },
          ]),
    ],
    [t],
  )

  const activeTab = useMemo(() => {
    const segments = pathname.split("/")
    const settingsIndex = segments.indexOf("settings")
    if (settingsIndex === -1) {
      // The audit-logs page lives outside the /settings subtree (enterprise
      // route group) but still renders this tab bar.
      return segments.includes("audit-logs") ? "audit-logs" : undefined
    }
    return segments[settingsIndex + 1]
  }, [pathname])

  return (
    <AppTab
      tabs={tabs.map((tab) => ({
        label: tab.label,
        href:
          tab.value === "audit-logs"
            ? `/space/${workspaceId}/audit-logs`
            : `/space/${workspaceId}/settings/${tab.value}`,
        isActive: activeTab === tab.value,
        disabled: scheduledForDeletion && tab.value !== GENERAL_TAB_VALUE,
        disabledTooltip: scheduledForDeletion
          ? t("workspace.deletion.navDisabledTooltip")
          : undefined,
      }))}
    />
  )
}
