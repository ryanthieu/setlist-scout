import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleAggregate } from "./handle-aggregate";
import { isRateLimited } from "./throttle";

type Bindings = {
  SETLISTFM_API_KEY: string;
  CACHE: KVNamespace;
};

const MB_USER_AGENT = "setlist-scout/0.1 (ryanthieu1@gmail.com)";

const ALLOWED_ORIGIN_PATTERNS = [
  /^chrome-extension:\/\//,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "/aggregate",
  cors({
    origin: (origin) =>
      origin && isAllowedOrigin(origin) ? origin : undefined,
  }),
);

app.use("/aggregate", async (c, next) => {
  const ip =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("x-forwarded-for") ??
    "unknown";
  if (await isRateLimited(c.env.CACHE, ip)) {
    return c.json(
      {
        error: {
          code: "rate_limited",
          message: "Too many requests. Try again shortly.",
        },
      },
      429,
    );
  }
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));

app.get("/aggregate", async (c) => {
  const result = await handleAggregate({
    artistQuery: c.req.query("artist"),
    mbidQuery: c.req.query("mbid"),
    kv: c.env.CACHE,
    apiKey: c.env.SETLISTFM_API_KEY,
    userAgent: MB_USER_AGENT,
  });

  return c.json(result.body, result.httpStatus);
});

export default app;
