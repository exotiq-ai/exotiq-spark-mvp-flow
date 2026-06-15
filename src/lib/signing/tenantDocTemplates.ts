/**
 * Tenant document signing templates (Phase 1).
 *
 * Each template defines a set of fields to overlay on the original PDF.
 * Coordinates are NORMALIZED (0..1) relative to the page (origin = bottom-left,
 * matching pdf-lib's coordinate system). Edge function `sign-tenant-document`
 * converts these to absolute page units when stamping.
 *
 * Phase 2 will let super admins drag-place fields and persist them in the
 * tenant_documents.field_overlay column; the schema is intentionally identical
 * so no migration churn is required when that UI ships.
 */

export type TenantDocFieldType = "signature" | "printed_name" | "title" | "date";

export interface TenantDocField {
  type: TenantDocFieldType;
  page: number | "last";       // 0-indexed; "last" = pdf last page
  x: number;                   // 0..1, left edge
  y: number;                   // 0..1, bottom edge
  width: number;               // 0..1
  height: number;              // 0..1
  required: boolean;
  label?: string;
}

export interface TenantDocTemplateMeta {
  id: "order_form" | "addendum" | "custom";
  label: string;
  description: string;
  fields: TenantDocField[];
}

// Common signature block on the lower half of the last page,
// matching the layout used by the Exotiq Order Form (signature line,
// printed name, title, date — stacked).
const COMMON_LAST_PAGE_BLOCK: TenantDocField[] = [
  {
    type: "signature",
    page: "last",
    x: 0.10,
    y: 0.30,
    width: 0.45,
    height: 0.08,
    required: true,
    label: "Signature",
  },
  {
    type: "printed_name",
    page: "last",
    x: 0.10,
    y: 0.22,
    width: 0.45,
    height: 0.03,
    required: true,
    label: "Printed Name",
  },
  {
    type: "title",
    page: "last",
    x: 0.10,
    y: 0.16,
    width: 0.45,
    height: 0.03,
    required: true,
    label: "Title",
  },
  {
    type: "date",
    page: "last",
    x: 0.10,
    y: 0.10,
    width: 0.30,
    height: 0.03,
    required: true,
    label: "Date",
  },
];

export const TENANT_DOC_TEMPLATES: Record<TenantDocTemplateMeta["id"], TenantDocTemplateMeta> = {
  order_form: {
    id: "order_form",
    label: "Order Form",
    description: "Founding Partner Order Form layout. Signature block on the last page.",
    fields: COMMON_LAST_PAGE_BLOCK,
  },
  addendum: {
    id: "addendum",
    label: "Addendum",
    description: "Generic addendum. Same signature block as the order form.",
    fields: COMMON_LAST_PAGE_BLOCK,
  },
  custom: {
    id: "custom",
    label: "Custom",
    description: "Safe default block anchored to the last page. Field placement editor coming in Phase 2.",
    fields: COMMON_LAST_PAGE_BLOCK,
  },
};

export function fieldsForTemplate(
  template: TenantDocTemplateMeta["id"]
): TenantDocField[] {
  return TENANT_DOC_TEMPLATES[template].fields;
}

/**
 * Resolves the "last" page sentinel against an actual page count, returning
 * absolute 0-indexed page references. Pure for unit testing.
 */
export function resolveFieldPages(
  fields: TenantDocField[],
  pageCount: number
): Array<TenantDocField & { resolvedPage: number }> {
  return fields.map((f) => ({
    ...f,
    resolvedPage: f.page === "last" ? Math.max(0, pageCount - 1) : f.page,
  }));
}

export const ESIGN_ACKNOWLEDGEMENT =
  "By signing below, I agree that this electronic signature is the legal equivalent of my manual signature on this document. I confirm I am authorized to bind the entity named above to its terms.";
