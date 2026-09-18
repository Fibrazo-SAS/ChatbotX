import { Input } from "@chatbotx.io/ui/components/ui/input"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { AdminWorkspacesTable } from "@/features/admin/components/admin-workspaces-table"
import { CreateAdminWorkspaceDialog } from "@/features/admin/components/create-admin-workspace-dialog"
import { listAdminWorkspaces } from "@/features/admin/queries/list-admin-workspaces"
import { getAdminWorkspacesSearchParamsCache } from "@/features/admin/schema/admin-workspace"

/**
 * Platform workspace directory. Only reachable by the platform super admin —
 * the `admin/layout.tsx` gate already covers this route. This is the list the
 * admin uses to see every workspace that exists (across tenants) and decide
 * where to assign users from /admin/users.
 */
export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const t = await getTranslations()
  const { page, perPage, keyword } = getAdminWorkspacesSearchParamsCache.parse(
    await searchParams,
  )

  const promises = Promise.all([
    listAdminWorkspaces({ page, perPage, keyword }),
  ])

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg sm:text-xl">
        {t("platformAdmin.workspaces.title")}
      </h3>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <form action="/admin/workspaces" className="flex max-w-sm gap-2">
          <Input
            defaultValue={keyword ?? ""}
            name="keyword"
            placeholder={t("platformAdmin.workspaces.searchPlaceholder")}
            type="search"
          />
          <input className="sr-only" type="submit" />
        </form>
        <CreateAdminWorkspaceDialog />
      </div>

      <Suspense>
        <AdminWorkspacesTable promises={promises} />
      </Suspense>
    </div>
  )
}
