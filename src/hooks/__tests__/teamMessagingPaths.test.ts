import { describe, expect, it, vi } from "vitest";
import { buildMessageAttachmentPath } from "../teamMessagingPaths";

describe("buildMessageAttachmentPath", () => {
  it("prefixes uploads with the conversation id for storage RLS", () => {
    vi.spyOn(Date, "now").mockReturnValue(1770000000000);

    expect(
      buildMessageAttachmentPath({
        conversationId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        fileName: "rental agreement.pdf",
      })
    ).toBe(
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/1770000000000-rental-agreement.pdf"
    );

    vi.restoreAllMocks();
  });
});
