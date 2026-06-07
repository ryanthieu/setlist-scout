import type { GetAggregateMessage, GetAggregateResult } from "./messages";

export function requestAggregateViaRuntime(
  artist: string,
): Promise<GetAggregateResult> {
  const message: GetAggregateMessage = { type: "GET_AGGREGATE", artist };
  return chrome.runtime.sendMessage(message);
}
