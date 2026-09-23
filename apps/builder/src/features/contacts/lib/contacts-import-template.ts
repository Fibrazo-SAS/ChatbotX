import { messagesByLocale } from "@/i18n/messages"

export const CONTACTS_IMPORT_TEMPLATE_FILENAME = "contacts-import-template.csv"

/**
 * The CSV columns for the contacts-import template: the union of every
 * channel's column-map targets (see `ContactImportColumnMap` and the worker's
 * `extractRowData`). WhatsApp does not read `contactId` (its identity comes
 * from the phone number) and only WhatsApp requires `phoneNumber`, but a
 * single combined template covers every channel's mapping dropdown.
 */
export const CONTACTS_IMPORT_TEMPLATE_COLUMNS = [
  "contactId",
  "phoneNumber",
  "email",
  "firstName",
  "lastName",
  "sourceUserId",
] as const

type ContactsImportTemplateColumn =
  (typeof CONTACTS_IMPORT_TEMPLATE_COLUMNS)[number]

// Maps a template column to the i18n `fields.*` key that carries its label.
// Only `sourceUserId` differs from its own name — it reuses the existing
// `waUserId` key shipped with the BSUID feature rather than adding a new one.
const TEMPLATE_COLUMN_MESSAGE_KEY: Record<
  ContactsImportTemplateColumn,
  string
> = {
  contactId: "contactId",
  phoneNumber: "phoneNumber",
  email: "email",
  firstName: "firstName",
  lastName: "lastName",
  sourceUserId: "waUserId",
}

type FieldLabelMessages = {
  fields?: Partial<Record<string, { label?: string }>>
}

const resolveColumnLabel = (column: ContactsImportTemplateColumn): string => {
  const messageKey = TEMPLATE_COLUMN_MESSAGE_KEY[column]
  const englishFields = (messagesByLocale.en as FieldLabelMessages).fields
  return englishFields?.[messageKey]?.label ?? column
}

// A single filled-in row so users see the expected format for each column
// rather than an empty template.
const TEMPLATE_EXAMPLE_ROW: Record<ContactsImportTemplateColumn, string> = {
  contactId: "1234567890",
  phoneNumber: "+14155550100",
  email: "john.doe@example.com",
  firstName: "John",
  lastName: "Doe",
  sourceUserId: "user.9187654321098765",
}

// Always quotes and doubles embedded quotes, mirroring the `escapeCsvValue`
// convention used by the worker's CSV export handlers
// (apps/worker/src/default/handlers/export-contacts.ts and export-coupons.ts).
// There is no shared CSV package yet, so this mirrors — rather than imports —
// that convention for consistency across the codebase.
const escapeCsvValue = (value: string): string =>
  `"${value.replace(/"/g, '""')}"`

const buildCsvRow = (values: readonly string[]): string =>
  values.map(escapeCsvValue).join(",")

/**
 * Builds the contacts-import CSV template: a header row covering every
 * channel's import columns followed by one example data row, prefixed with a
 * UTF-8 BOM so spreadsheet apps (Excel, Sheets) render non-ASCII labels
 * correctly.
 */
export const buildContactsImportTemplateCsv = (): string => {
  const headerRow = buildCsvRow(
    CONTACTS_IMPORT_TEMPLATE_COLUMNS.map((column) =>
      resolveColumnLabel(column),
    ),
  )
  const exampleRow = buildCsvRow(
    CONTACTS_IMPORT_TEMPLATE_COLUMNS.map(
      (column) => TEMPLATE_EXAMPLE_ROW[column],
    ),
  )

  return `﻿${headerRow}\n${exampleRow}\n`
}
