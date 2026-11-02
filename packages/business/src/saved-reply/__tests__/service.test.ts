import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findFile: vi.fn(),
  findOrFail: vi.fn(),
  insertReturning: vi.fn(),
  updateReturning: vi.fn(),
  deleteWhere: vi.fn(),
  headObject: vi.fn(),
  deleteObject: vi.fn(),
  createId: vi.fn(() => "sr_1"),
  dispatchAuditRecord: vi.fn(),
}))

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      fileModel: {
        findFirst: mocks.findFile,
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mocks.insertReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: mocks.updateReturning,
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: mocks.deleteWhere,
    })),
  },
  eq: vi.fn((column, value) => ({ column, value })),
  findOrFail: mocks.findOrFail,
}))

vi.mock("@chatbotx.io/filesystem", () => ({
  uploader: {
    headObject: mocks.headObject,
    deleteObject: mocks.deleteObject,
  },
}))

vi.mock("@chatbotx.io/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@chatbotx.io/utils")>()
  return { ...actual, createId: mocks.createId }
})

vi.mock("../../audit/dispatcher", () => ({
  dispatchAuditRecord: mocks.dispatchAuditRecord,
}))

vi.mock("@chatbotx.io/redis", () => ({
  invalidateCacheByTags: vi.fn(),
}))

vi.mock("../../template/installed-resource.service", () => ({
  assertDeletable: vi.fn(async () => undefined),
}))

import { savedReplyService } from "../service"

const imageFileRow = {
  id: "file_1",
  path: "public/space/ws_1/saved-replies/img.png",
  mimeType: "image/png",
}

const savedReplyRow = {
  id: "sr_1",
  workspaceId: "ws_1",
  shortcut: null,
  text: "Hola",
  imagePath: null,
  secondText: null,
  createdById: "user_1",
  updatedById: "user_1",
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findFile.mockResolvedValue(undefined)
  mocks.headObject.mockResolvedValue({ ContentLength: 1000 })
  mocks.insertReturning.mockResolvedValue([savedReplyRow])
  mocks.updateReturning.mockResolvedValue([savedReplyRow])
  mocks.deleteWhere.mockResolvedValue(undefined)
  mocks.findOrFail.mockResolvedValue(savedReplyRow)
})

describe("savedReplyService.create", () => {
  test("creates a reply without shortcut and no image", async () => {
    mocks.insertReturning.mockResolvedValue([
      { ...savedReplyRow, createdById: "user_1", updatedById: "user_1" },
    ])

    await savedReplyService.create({
      workspaceId: "ws_1",
      userId: "user_1",
      content: { text: "Hola" },
    })

    expect(mocks.insertReturning).toHaveBeenCalledOnce()
    expect(mocks.dispatchAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create" }),
    )
  })

  test("resolves the image path from the uploaded File row", async () => {
    mocks.findFile.mockResolvedValue(imageFileRow)

    await savedReplyService.create({
      workspaceId: "ws_1",
      userId: "user_1",
      content: {
        text: "Con imagen",
        imageFileId: "file_1",
        secondText: "Debajo de la imagen",
      },
    })

    expect(mocks.findFile).toHaveBeenCalledWith({
      where: { id: "file_1", workspaceId: "ws_1" },
    })
    expect(mocks.insertReturning).toHaveBeenCalledOnce()
  })

  test("throws when the uploaded File row does not exist", async () => {
    mocks.findFile.mockResolvedValue(undefined)

    await expect(
      savedReplyService.create({
        workspaceId: "ws_1",
        userId: "user_1",
        content: { text: "Con imagen", imageFileId: "file_1" },
      }),
    ).rejects.toThrow("Image not found")
  })

  test("throws when the image is not JPEG or PNG", async () => {
    mocks.findFile.mockResolvedValue({ ...imageFileRow, mimeType: "image/gif" })

    await expect(
      savedReplyService.create({
        workspaceId: "ws_1",
        userId: "user_1",
        content: { text: "Con imagen", imageFileId: "file_1" },
      }),
    ).rejects.toThrow("Only JPEG or PNG images are supported")
  })

  test("throws when the image exceeds 5 MB", async () => {
    mocks.findFile.mockResolvedValue(imageFileRow)
    mocks.headObject.mockResolvedValue({ ContentLength: 6 * 1024 * 1024 })

    await expect(
      savedReplyService.create({
        workspaceId: "ws_1",
        userId: "user_1",
        content: { text: "Con imagen", imageFileId: "file_1" },
      }),
    ).rejects.toThrow("Image exceeds the 5 MB limit")
  })

  test("throws when secondText is provided without an image", async () => {
    await expect(
      savedReplyService.create({
        workspaceId: "ws_1",
        userId: "user_1",
        content: { text: "Solo texto", secondText: "No debería estar" },
      }),
    ).rejects.toThrow("Second text requires an image")
  })
})

describe("savedReplyService.update", () => {
  const existing = {
    ...savedReplyRow,
    imagePath: "public/space/ws_1/saved-replies/old.png",
    secondText: "Antigua",
  }

  test("keeps the current image when no new upload or removal is given", async () => {
    mocks.findOrFail.mockResolvedValue(existing)
    mocks.updateReturning.mockResolvedValue([existing])

    await savedReplyService.update({
      workspaceId: "ws_1",
      id: "sr_1",
      userId: "user_2",
      content: { text: "Editado", secondText: "Antigua" },
    })

    expect(mocks.deleteObject).not.toHaveBeenCalled()
    expect(mocks.updateReturning).toHaveBeenCalledOnce()
  })

  test("replaces the image and deletes the previous object", async () => {
    mocks.findOrFail.mockResolvedValue(existing)
    mocks.findFile.mockResolvedValue({
      ...imageFileRow,
      path: "public/space/ws_1/saved-replies/new.png",
    })
    mocks.updateReturning.mockResolvedValue([
      { ...existing, imagePath: "public/space/ws_1/saved-replies/new.png" },
    ])

    await savedReplyService.update({
      workspaceId: "ws_1",
      id: "sr_1",
      userId: "user_2",
      content: { text: "Editado", imageFileId: "file_1" },
    })

    expect(mocks.deleteObject).toHaveBeenCalledWith(
      "public/space/ws_1/saved-replies/old.png",
    )
  })

  test("removes the image and its object when removeImage is set", async () => {
    mocks.findOrFail.mockResolvedValue(existing)
    mocks.updateReturning.mockResolvedValue([
      { ...existing, imagePath: null, secondText: null },
    ])

    await savedReplyService.update({
      workspaceId: "ws_1",
      id: "sr_1",
      userId: "user_2",
      content: { text: "Solo texto", removeImage: true },
    })

    expect(mocks.deleteObject).toHaveBeenCalledWith(
      "public/space/ws_1/saved-replies/old.png",
    )
  })

  test("throws when secondText remains without a final image", async () => {
    mocks.findOrFail.mockResolvedValue(existing)

    await expect(
      savedReplyService.update({
        workspaceId: "ws_1",
        id: "sr_1",
        userId: "user_2",
        content: { text: "Editado", removeImage: true, secondText: "Huérfano" },
      }),
    ).rejects.toThrow("Second text requires an image")
  })
})

describe("savedReplyService.delete", () => {
  test("deletes the row and the stored image object", async () => {
    mocks.findOrFail.mockResolvedValue({
      ...savedReplyRow,
      imagePath: "public/space/ws_1/saved-replies/img.png",
    })

    await savedReplyService.delete({ workspaceId: "ws_1", id: "sr_1" })

    expect(mocks.deleteWhere).toHaveBeenCalledOnce()
    expect(mocks.deleteObject).toHaveBeenCalledWith(
      "public/space/ws_1/saved-replies/img.png",
    )
  })
})
