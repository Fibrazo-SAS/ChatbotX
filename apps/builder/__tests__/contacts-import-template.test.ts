// @vitest-environment node
import { describe, expect, test } from "vitest"
import {
  buildContactsImportTemplateCsv,
  CONTACTS_IMPORT_TEMPLATE_COLUMNS,
  CONTACTS_IMPORT_TEMPLATE_FILENAME,
} from "@/features/contacts/lib/contacts-import-template"

const UTF8_BOM = "﻿"

describe("buildContactsImportTemplateCsv", () => {
  const EN_TEMPLATE =
    '"Contact ID","Phone number","Email","First name","Last name","WhatsApp User ID"\n' +
    '"1234567890","+14155550100","john.doe@example.com","John","Doe","user.9187654321098765"\n'

  test("returns quoted English headers and an example row with a UTF-8 BOM", () => {
    const csv = buildContactsImportTemplateCsv()

    expect(csv.startsWith(UTF8_BOM)).toBe(true)
    expect(csv.slice(UTF8_BOM.length)).toBe(EN_TEMPLATE)
  })

  test("emits a header row and exactly one example data row", () => {
    const csv = buildContactsImportTemplateCsv()
    const rows = csv.slice(UTF8_BOM.length).trimEnd().split("\n")

    expect(CONTACTS_IMPORT_TEMPLATE_COLUMNS).toEqual([
      "contactId",
      "phoneNumber",
      "email",
      "firstName",
      "lastName",
      "sourceUserId",
    ])
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.split(",")).toHaveLength(
        CONTACTS_IMPORT_TEMPLATE_COLUMNS.length,
      )
    }
  })

  test("exposes a stable download filename", () => {
    expect(CONTACTS_IMPORT_TEMPLATE_FILENAME).toBe(
      "contacts-import-template.csv",
    )
  })
})
