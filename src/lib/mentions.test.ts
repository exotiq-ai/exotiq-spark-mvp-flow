import { describe, it, expect } from "vitest";
import { parseMentions, buildPickerItems, type MentionContext } from "@/lib/mentions";

const ctx: MentionContext = {
  conversationMemberIds: ["u1", "u2", "u3"],
  teamMembers: [
    { id: "u1", handle: "mike", name: "Mike Smith", role: "owner", is_active: true },
    { id: "u2", handle: "sarah", name: "Sarah Lee", role: "admin", is_active: true },
    { id: "u3", handle: "alex", name: "Alex Park", role: "manager", is_active: true },
    { id: "u4", handle: "old", name: "Old User", role: "viewer", is_active: false },
  ],
  groups: [{ slug: "sales", name: "Sales", member_ids: ["u1", "u2"] }],
};

describe("mentions", () => {
  it("resolves user handles", () => {
    const { recipientIds } = parseMentions("hey @mike check this", ctx);
    expect(recipientIds).toEqual(["u1"]);
  });

  it("expands role mentions", () => {
    const { recipientIds, tokens } = parseMentions("@admins ping", ctx);
    expect(recipientIds).toEqual(["u2"]);
    expect(tokens[0].kind).toBe("role");
  });

  it("expands custom groups", () => {
    const { recipientIds } = parseMentions("@sales meeting in 5", ctx);
    expect(recipientIds.sort()).toEqual(["u1", "u2"]);
  });

  it("@all returns conversation members", () => {
    const { recipientIds } = parseMentions("@all heads up", ctx);
    expect(recipientIds.sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("excludes sender from recipients", () => {
    const { recipientIds } = parseMentions("@all team", ctx, "u1");
    expect(recipientIds.sort()).toEqual(["u2", "u3"]);
  });

  it("dedupes repeated mentions", () => {
    const { recipientIds } = parseMentions("@mike @mike @mike", ctx);
    expect(recipientIds).toEqual(["u1"]);
  });

  it("filters recipients not in conversation", () => {
    const limited: MentionContext = { ...ctx, conversationMemberIds: ["u1"] };
    const { recipientIds } = parseMentions("@all", limited);
    expect(recipientIds).toEqual(["u1"]);
  });

  it("ignores unresolved tokens", () => {
    const { tokens, recipientIds } = parseMentions("hello @nobody there", ctx);
    expect(tokens).toEqual([]);
    expect(recipientIds).toEqual([]);
  });

  it("picker hides inactive users and excludes self", () => {
    const items = buildPickerItems("", ctx, true, "u1");
    const userKeys = items.filter((i) => i.kind === "user").map((i) => i.key);
    expect(userKeys).not.toContain("user:u1"); // self
    expect(userKeys).not.toContain("user:u4"); // inactive
  });

  it("picker hides @all when not admin", () => {
    const items = buildPickerItems("", ctx, false);
    expect(items.find((i) => i.kind === "all")).toBeUndefined();
  });
});
