import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useBabyData } from "./useBabyData";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.stubGlobal("fetch", vi.fn(async (url) => ({
    ok: true,
    status: 200,
    json: async () => url === "./api/config"
      ? { refresh_interval: 30 }
      : { results: url.endsWith("/children/") ? [{ id: 1 }] : [] },
  })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("rolling sleep-history cutoff", () => {
  it.each([
    ["the first repeated Brussels hour", "2026-10-26T00:46:31.553Z", "2026-10-25T00:46:31.553Z"],
    ["the second repeated Brussels hour", "2026-10-26T01:46:31.553Z", "2026-10-25T01:46:31.553Z"],
    ["the autumn clock change", "2026-10-25T01:46:31.553Z", "2026-10-24T01:46:31.553Z"],
    ["the spring clock change", "2026-03-29T01:46:31.553Z", "2026-03-28T01:46:31.553Z"],
    ["the day after the spring clock change", "2026-03-30T01:46:31.553Z", "2026-03-29T01:46:31.553Z"],
    ["midnight", "2026-10-27T00:00:00.000Z", "2026-10-26T00:00:00.000Z"],
  ])("preserves an unambiguous 24-hour instant across %s", async (_label, now, expectedCutoff) => {
    vi.setSystemTime(new Date(now));
    const { result } = renderHook(() => useBabyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    const requests = fetch.mock.calls.map(([url]) => new URL(url, "http://localhost"));
    const sleepRequest = requests.find((url) => url.pathname.endsWith("/sleep/")
      && url.searchParams.get("limit") === "100");
    const cutoff = sleepRequest.searchParams.get("start_min");
    expect(cutoff).toBe(expectedCutoff);
    expect(Date.parse(now) - Date.parse(cutoff)).toBe(24 * 60 * 60 * 1000);
  });
});
