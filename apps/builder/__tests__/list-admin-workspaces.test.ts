// @vitest-environment node

import { beforeEach, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  workspaceModel: {},
}))

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      workspaceModel: {
        findMany: (args: unknown) => mocks.findMany(args),
      },
    },
    $count: (model: unknown, where: unknown) => mocks.count(model, where),
  },
  ilike: () => "ilike",
}))

const { listAdminWorkspaces } = await import(
  "../src/features/admin/queries/list-admin-workspaces"
)

const member = (
  role: "owner" | "agent",
  id: string,
  name: string | null,
  email: string,
) => ({
  role,
  userId: id,
  user: { id, name, email },
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.count.mockResolvedValue(1)
})

test("maps ownerCount, members and workspace state", async () => {
  mocks.findMany.mockResolvedValue([
    {
      id: "ws-1",
      name: "Acme",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      tenantId: "t-1",
      isActive: false,
      scheduledDeletionAt: null,
      workspaceMembers: [
        member("owner", "u-1", "Ana", "ana@x.com"),
        member("agent", "u-2", null, "bob@x.com"),
      ],
    },
  ])

  const result = await listAdminWorkspaces({
    page: null,
    perPage: null,
    keyword: null,
  })

  expect(result.pageCount).toBe(1)
  expect(result.data).toHaveLength(1)

  const workspace = result.data[0]
  expect(workspace.ownerCount).toBe(1)
  expect(workspace.memberCount).toBe(2)
  expect(workspace.isActive).toBe(false)
  expect(workspace.scheduledDeletionAt).toBeNull()
  expect(workspace.owners).toEqual([
    { id: "u-1", name: "Ana", email: "ana@x.com" },
  ])
  expect(workspace.members).toEqual([
    { id: "u-1", name: "Ana", email: "ana@x.com", role: "owner" },
    { id: "u-2", name: null, email: "bob@x.com", role: "agent" },
  ])
})

test("counts every owner when several exist", async () => {
  mocks.findMany.mockResolvedValue([
    {
      id: "ws-2",
      name: "Beta",
      createdAt: new Date("2026-01-02T00:00:00Z"),
      tenantId: "t-1",
      isActive: true,
      scheduledDeletionAt: new Date("2026-01-03T00:00:00Z"),
      workspaceMembers: [
        member("owner", "u-1", "Ana", "ana@x.com"),
        member("owner", "u-2", null, "bob@x.com"),
      ],
    },
  ])

  const result = await listAdminWorkspaces({
    page: null,
    perPage: null,
    keyword: null,
  })

  expect(result.data[0].ownerCount).toBe(2)
  expect(result.data[0].owners).toHaveLength(2)
  expect(result.data[0].scheduledDeletionAt).toBeInstanceOf(Date)
})
