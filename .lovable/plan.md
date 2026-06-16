# Tenant Document Signing — Option A complete

## Status

**Option A (current signing flow):** ✅ Shipped and live.
- Clean PDF viewer with paged navigation
- Side-panel printed name + title + drawn signature
- ESIGN/UETA acknowledgement gates
- Server-side stamp + Certificate of Completion + SHA-256 sealing
- Dual storage: tenant Vault + Exotiq compliance archive
- Email to `hello@exotiq.ai` with signed PDF attached
- Audit trail in `tenant_document_audit`

**Tidy-up done today:** Removed the "Fill any form fields directly in the
document…" copy from the signer panel — the PDFs are flat so that promise
was a false affordance. New copy describes what actually happens.

## Option B — Overlay field editor

Backlogged with full plan, estimates, and verification checklist:
**[TODO_TENANT_DOC_OVERLAY_FIELDS.md](../TODO_TENANT_DOC_OVERLAY_FIELDS.md)**

Picking up later this week.
