// Deno tests for the AI transfer guard's redaction logic.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { __test } from "./transferGuard.ts";

const { redact } = __test;

Deno.test("standard level leaves PII keys untouched", () => {
  const input = { customer: { full_name: "Jane Doe", email: "jane@example.com" } };
  const { payload, fieldCount, redactedCount } = redact(input, "standard");
  assertEquals(redactedCount, 0);
  assert(fieldCount >= 3);
  assertEquals((payload as any).customer.full_name, "Jane Doe");
});

Deno.test("strict level pseudonymizes PII keys", () => {
  const input = { customer: { full_name: "Jane Doe", email: "jane@example.com" } };
  const { payload, redactedCount } = redact(input, "strict");
  assert(redactedCount >= 2);
  assert((payload as any).customer.full_name.startsWith("<full_name:"));
  assert((payload as any).customer.email.startsWith("<email:"));
});

Deno.test("never_transfer keys are dropped at both levels", () => {
  const input = { drivers_license_number: "ABC123", other: 1 };
  const strict = redact(input, "strict");
  const standard = redact(input, "standard");
  assertEquals((strict.payload as any).drivers_license_number, undefined);
  assertEquals((standard.payload as any).drivers_license_number, undefined);
  assertEquals((strict.payload as any).other, 1);
});

Deno.test("non-string PII values are not pseudonymized", () => {
  const input = { phone: 5551234, dob: { year: 1990 } };
  const { payload } = redact(input, "strict");
  assertEquals((payload as any).phone, 5551234);
  assertEquals((payload as any).dob.year, 1990);
});

Deno.test("arrays are walked", () => {
  const input = { customers: [{ email: "a@b.c" }, { email: "d@e.f" }] };
  const { redactedCount } = redact(input, "strict");
  assertEquals(redactedCount, 2);
});
