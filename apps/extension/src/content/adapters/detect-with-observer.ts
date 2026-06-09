import type { EventContext } from "@setlist-scout/shared";

const OBSERVER_TIMEOUT_MS = 10_000;

/**
 * Shared by every SiteAdapter: try extraction immediately (JSON-LD is
 * usually already server-rendered), and if that comes up empty, watch the
 * DOM for up to OBSERVER_TIMEOUT_MS in case this is a client-rendered SPA
 * that hasn't painted the event yet.
 */
export function detectWithObserver(
  tryExtract: () => EventContext | null,
): Promise<EventContext | null> {
  const immediate = tryExtract();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: EventContext | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      observer.disconnect();
      resolve(result);
    };

    const observer = new MutationObserver(() => {
      const result = tryExtract();
      if (result) finish(result);
    });

    const timeoutId = setTimeout(
      () => finish(tryExtract()),
      OBSERVER_TIMEOUT_MS,
    );

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });
}
