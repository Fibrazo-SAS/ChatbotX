import { Input } from "@chatbotx.io/ui/components/ui/input"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { CreatePlatformUserDialog } from "@/features/users/components/create-platform-user-dialog"
import { PlatformUsersTable } from "@/features/users/components/platform-users-table"
import { listPlatformUsers } from "@/features/users/queries/list-platform-users"
import { getPlatformUsersSearchParamsCache } from "@/features/users/schema/platform-user"

/**
 * Platform user directory. Only reachable by the platform super admin — the
 * `admin/layout.tsx` gate (`isSuperAdmin`) already covers this route; this page
 * itself performs no additional authorization.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const t = await getTranslations()
  const { page, perPage, keyword } = getPlatformUsersSearchParamsCache.parse(
    await searchParams,
  )

  const promises = Promise.all([listPlatformUsers({ page, perPage, keyword })])

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg sm:text-xl">
        {t("platformAdmin.users.title")}
      </h3>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <form action="/admin/users" className="flex max-w-sm gap-2">
          <Input
            defaultValue={keyword ?? ""}
            name="keyword"
            placeholder={t("platformAdmin.users.searchPlaceholder")}
            type="search"
          />
          <input className="sr-only" type="submit" />
        </form>
        <CreatePlatformUserDialog />
      </div>

      <Suspense>
        <PlatformUsersTable promises={promises} />
      </Suspense>
    </div>
  )
}
