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
