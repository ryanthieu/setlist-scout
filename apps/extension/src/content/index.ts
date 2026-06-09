import { mountPanel } from "../panel/mount";
import { DiceAdapter } from "./adapters/dice";
import type { SiteAdapter } from "./adapters/site-adapter";
import { TicketmasterAdapter } from "./adapters/ticketmaster";

const adapters: SiteAdapter[] = [new TicketmasterAdapter(), new DiceAdapter()];

async function run(): Promise<void> {
  const url = new URL(location.href);
  const adapter = adapters.find((a) => a.matches(url));
  if (!adapter) return;

  const context = await adapter.detect();
  console.log("[setlist-scout] event detection:", context);
  if (context) {
    await mountPanel(context);
  }
}

void run();
