import type { AggregateResponse } from "@setlist-scout/shared";

export type GetAggregateMessage = { type: "GET_AGGREGATE"; artist: string };

export type GetAggregateResult =
  | { ok: true; data: AggregateResponse }
  | { ok: false; error: { code: string; message: string } };

export function isGetAggregateMessage(
  value: unknown,
): value is GetAggregateMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "GET_AGGREGATE" &&
    typeof (value as { artist?: unknown }).artist === "string"
  );
}

// chrome.storage is unavailable inside this project's content script
// execution context (confirmed live: `chrome.storage` is undefined there,
// throwing when options.ts tries to read it) -- routed through the
// background instead, which has proven, working chrome.storage access
// (it already uses chrome.storage.session for the aggregate cache).
export type GetOptionsMessage = { type: "GET_OPTIONS" };

export function isGetOptionsMessage(
  value: unknown,
): value is GetOptionsMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "GET_OPTIONS"
  );
}
