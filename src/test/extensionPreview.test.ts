// A preview must never be sent to a server that cannot preview: an old rent-extend-booking would carry it out and charge.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetExtensionPreviewSupport, supportsExtensionPreview } from "../lib/extensionPreview";

beforeEach(() => resetExtensionPreviewSupport());

describe("extension preview support", () => {
  it("is supported only when the server says so", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { capabilities: { dry_run: true } }, error: null });
    expect(await supportsExtensionPreview(invoke)).toBe(true);
    expect(invoke).toHaveBeenCalledWith("rent-extend-booking", { body: { probe: "capabilities" } });
  });

  it("an OLD server answers the probe with an error (it requires booking_id), so no preview is ever sent", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { message: "Edge function returned a non-2xx status code" } });
    expect(await supportsExtensionPreview(invoke)).toBe(false);
  });

  it("an old server that answers 200 with something else, or a network failure, also means 'not supported'", async () => {
    expect(await supportsExtensionPreview(vi.fn().mockResolvedValue({ data: { error: "booking_id required" }, error: null }))).toBe(false);
    resetExtensionPreviewSupport();
    expect(await supportsExtensionPreview(vi.fn().mockRejectedValue(new Error("offline")))).toBe(false);
  });

  it("asks only once per session", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { capabilities: { dry_run: true } }, error: null });
    await supportsExtensionPreview(invoke);
    await supportsExtensionPreview(invoke);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
