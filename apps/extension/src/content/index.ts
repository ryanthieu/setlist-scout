import { mountPanel } from "../panel/mount";
import type { SiteAdapter } from "./adapters/site-adapter";
import { TicketmasterAdapter } from "./adapters/ticketmaster";

const adapters: SiteAdapter[] = [new TicketmasterAdapter()];

async function run(): Promise<void> {
  const url = new URL(location.href);
  const adapter = adapters.find((a) => a.matches(url));
  if (!adapter) return;

  const context = await adapter.detect();
  console.log("[setlist-scout] event detection:", context);
  if (context) {
    mountPanel(context);
  }
}

void run();
