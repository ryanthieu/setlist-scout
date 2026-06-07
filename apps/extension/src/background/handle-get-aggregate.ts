import type { AggregateResponse } from "@setlist-scout/shared";
import type { GetAggregateResult } from "../lib/messages";
import { WORKER_URL } from "../lib/worker-url";

export type HandleGetAggregateDeps = {
  cacheGet: (artist: string) => Promise<AggregateResponse | undefined>;
  cacheSet: (artist: string, value: AggregateResponse) => Promise<void>;
  fetchImpl?: typeof fetch;
  workerUrl?: string;
};

export async function handleGetAggregate(
  artist: string,
  deps: HandleGetAggregateDeps,
): Promise<GetAggregateResult> {
  const {
    cacheGet,
    cacheSet,
    fetchImpl = fetch,
    workerUrl = WORKER_URL,
  } = deps;

  const cached = await cacheGet(artist);
  if (cached) return { ok: true, data: cached };

  if (!workerUrl) {
    return {
      ok: false,
      error: {
        code: "worker_not_configured",
        message: "Setlist Scout's server isn't configured yet.",
      },
    };
  }

  try {
    const res = await fetchImpl(
      `${workerUrl}/aggregate?artist=${encodeURIComponent(artist)}`,
    );
    if (!res.ok) {
      return {
        ok: false,
        error: {
          code: "worker_error",
          message: `Setlist Scout's server returned an error (${res.status}).`,
        },
      };
    }

    const data = (await res.json()) as AggregateResponse;
    await cacheSet(artist, data);
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: {
        code: "network_error",
        message: "Could not reach Setlist Scout's server.",
      },
    };
  }
}
