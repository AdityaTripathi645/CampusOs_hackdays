import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryRateLimiter } from "../src/lib/rate-limit";

test("memory rate limiter applies a sliding window and resets a key", () => {
  let now = 1_000;
  const limiter = createMemoryRateLimiter(() => now);

  assert.deepEqual(limiter.limit("user-a", 2, 10_000), { success: true, retryAfterSeconds: 0 });
  now += 1_000;
  assert.deepEqual(limiter.limit("user-a", 2, 10_000), { success: true, retryAfterSeconds: 0 });
  assert.deepEqual(limiter.limit("user-a", 2, 10_000), { success: false, retryAfterSeconds: 9 });

  now += 1_000;
  assert.deepEqual(limiter.limit("user-b", 2, 10_000), { success: true, retryAfterSeconds: 0 });
  now = 11_000;
  assert.deepEqual(limiter.limit("user-a", 2, 10_000), { success: true, retryAfterSeconds: 0 });
  limiter.reset("user-a", 2, 10_000);
  assert.deepEqual(limiter.limit("user-a", 2, 10_000), { success: true, retryAfterSeconds: 0 });
});
