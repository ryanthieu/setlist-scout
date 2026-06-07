import type { AggregateResponse } from "@setlist-scout/shared";
import type { GetAggregateResult } from "../lib/messages";

export type OkAggregate = Extract<AggregateResponse, { status: "ok" }>;

export type PanelViewState =
  | { kind: "loading" }
  | { kind: "ok"; data: OkAggregate }
  | { kind: "insufficient_data"; artistName: string; showCount: number }
  | { kind: "artist_not_found"; query: string }
  | { kind: "error"; message: string };

/** Maps the raw message result into a state the panel can render directly. */
export function toPanelViewState(
  result: GetAggregateResult | "loading",
): PanelViewState {
  if (result === "loading") return { kind: "loading" };
  if (!result.ok) return { kind: "error", message: result.error.message };

  const { data } = result;
  if (data.status === "ok") return { kind: "ok", data };
  if (data.status === "insufficient_data") {
    return {
      kind: "insufficient_data",
      artistName: data.artistName,
      showCount: data.showCount,
    };
  }
  return { kind: "artist_not_found", query: data.query };
}
