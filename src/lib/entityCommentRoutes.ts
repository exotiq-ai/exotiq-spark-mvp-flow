// Maps an entity-comment context to its human label and deep link.
// Used by EntityCommentThread and the entity-mention-notification email.

export type EntityType =
  | "booking"
  | "vehicle"
  | "customer"
  | "payment"
  | "damage_claim"
  | "work_order"
  | "vehicle_task"
  | "inspection"
  | "document"
  | "customer_note"
  | "partner_payout";

export const ENTITY_LABELS: Record<EntityType, string> = {
  booking: "booking",
  vehicle: "vehicle",
  customer: "customer",
  payment: "payment",
  damage_claim: "damage claim",
  work_order: "work order",
  vehicle_task: "task",
  inspection: "inspection",
  document: "document",
  customer_note: "customer note",
  partner_payout: "payout",
};

export const buildEntityHref = (entityType: EntityType, entityId: string): string => {
  switch (entityType) {
    case "booking":
      return `/dashboard/bookings?bookingId=${entityId}`;
    case "vehicle":
      return `/dashboard/fleet?vehicleId=${entityId}`;
    case "customer":
      return `/dashboard/customers?customerId=${entityId}`;
    case "damage_claim":
      return `/dashboard/damages?claimId=${entityId}`;
    case "work_order":
    case "vehicle_task":
      return `/dashboard/fleet?workOrderId=${entityId}`;
    case "inspection":
      return `/dashboard/inspections?inspectionId=${entityId}`;
    case "document":
      return `/dashboard/settings?tab=documents&docId=${entityId}`;
    case "payment":
      return `/dashboard/payments?paymentId=${entityId}`;
    case "partner_payout":
      return `/dashboard/partners?payoutId=${entityId}`;
    case "customer_note":
      return `/dashboard/customers?noteId=${entityId}`;
    default:
      return "/dashboard";
  }
};

export const isImmutableEntityType = (t: EntityType): boolean => t === "damage_claim";

/** Set of entity types accepted by the edge function (defense in depth). */
export const ALLOWED_ENTITY_TYPES: ReadonlySet<EntityType> = new Set<EntityType>([
  "booking",
  "vehicle",
  "customer",
  "payment",
  "damage_claim",
  "work_order",
  "vehicle_task",
  "inspection",
  "document",
  "customer_note",
  "partner_payout",
]);
