// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "node:fs";
import path from "node:path";

export default defineConfig({
  vite: {
    server: {
      allowedHosts: true,
    },
    plugins: [
      {
        name: "serve-crazy-pay-root",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            let parsedPath = "";
            try {
              if (req.url && (req.url.startsWith("http://") || req.url.startsWith("https://"))) {
                parsedPath = new URL(req.url).pathname;
              } else {
                parsedPath = (req.url || "").split("?")[0];
              }
            } catch {
              parsedPath = (req.url || "").split("?")[0];
            }
            // Normalize multiple leading slashes (e.g. //api/...) and strip trailing slash
            const normalizedPath =
              ("/" + parsedPath.replace(/^\/+/, "")).replace(/\/+$/, "") || "/";
            const isApi = normalizedPath === "/api" || normalizedPath.startsWith("/api/");

            if (
              !isApi &&
              (normalizedPath === "" ||
                normalizedPath === "/" ||
                normalizedPath === "/index.html" ||
                normalizedPath === "/admin" ||
                normalizedPath === "/admin-panel" ||
                normalizedPath === "/dashboard" ||
                normalizedPath.startsWith("/admin/") ||
                normalizedPath.startsWith("/dashboard/"))
            ) {
              const indexPath = path.resolve(process.cwd(), "public/index.html");
              if (fs.existsSync(indexPath)) {
                if (req.method === "HEAD") {
                  res.writeHead(200, {
                    "content-type": "text/html; charset=utf-8",
                    "cache-control": "no-store",
                  });
                  res.end();
                  return;
                }
                res.writeHead(200, {
                  "content-type": "text/html; charset=utf-8",
                  "cache-control": "no-store",
                });
                fs.createReadStream(indexPath).pipe(res);
                return;
              }
            }

            if (isApi) {
              const securityHeaders: Record<string, string> = {
                "content-type": "application/json; charset=utf-8",
                "x-content-type-options": "nosniff",
                "x-frame-options": "SAMEORIGIN",
                "referrer-policy": "strict-origin-when-cross-origin",
                "x-xss-protection": "1; mode=block",
                "x-crazypay-shield": "active-v8-enforced",
                "access-control-allow-origin": "*",
                "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
                "access-control-allow-headers":
                  "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-CrazyPay-Shield, X-Shield-Timestamp, X-Client-Signature",
                "access-control-expose-headers": "X-CrazyPay-Shield, X-Shield-Timestamp",
                "access-control-max-age": "86400",
                "cache-control": "no-store, no-cache, must-revalidate",
              };

              for (const [k, v] of Object.entries(securityHeaders)) {
                res.setHeader(k, v);
              }

              if (req.method === "OPTIONS") {
                res.writeHead(204, securityHeaders);
                res.end();
                return;
              }

              const processApiRequest = async (bodyBuf: Buffer) => {
                try {
                  const reqHeaders = new Headers();
                  for (const [key, val] of Object.entries(req.headers)) {
                    if (val) {
                      if (Array.isArray(val)) {
                        val.forEach((v) => reqHeaders.append(key, v));
                      } else {
                        reqHeaders.set(key, val);
                      }
                    }
                  }

                  const queryPart = (req.url || "").includes("?")
                    ? "?" + (req.url || "").split("?").slice(1).join("?")
                    : "";
                  const fullUrl = `http://localhost:3000${normalizedPath}${queryPart}`;
                  const fetchReq = new Request(fullUrl, {
                    method: req.method,
                    headers: reqHeaders,
                    body: ["GET", "HEAD"].includes(req.method || "") ? null : bodyBuf,
                  });

                  // 1. P2P Engine & Provider Routes (MobiKwik, Gateways, Auth, Trades)
                  if (
                    normalizedPath.startsWith("/api/v1/auth") ||
                    normalizedPath.startsWith("/api/v1/providers") ||
                    normalizedPath.startsWith("/api/v1/accounts") ||
                    normalizedPath.startsWith("/api/v1/marketplace") ||
                    normalizedPath.startsWith("/api/v1/trades") ||
                    normalizedPath.startsWith("/api/v1/engine") ||
                    normalizedPath.startsWith("/api/v1/verification")
                  ) {
                    const { handleP2pEngineApi } = await import("./src/lib/p2p-engine-api.ts");
                    const engineRes = await handleP2pEngineApi(fetchReq.clone());
                    if (engineRes) {
                      const resHeaders = {
                        ...Object.fromEntries(engineRes.headers.entries()),
                        ...securityHeaders,
                      };
                      res.writeHead(engineRes.status, resHeaders);
                      const engineText = await engineRes.text();
                      res.end(engineText);
                      return;
                    }
                  }

                  // 2. P2P API Handler (fetch_upi, verify-utr, upi handles, toggle_status)
                  if (
                    normalizedPath.startsWith("/api/v1/p2p") ||
                    normalizedPath === "/api/v1/orders/verify-utr" ||
                    normalizedPath === "/api/fetch_upi" ||
                    normalizedPath === "/api/fetch-upi" ||
                    normalizedPath === "/api/get-upi" ||
                    normalizedPath === "/api/get_upi" ||
                    normalizedPath === "/api/upi" ||
                    normalizedPath === "/api/upi_handles" ||
                    normalizedPath === "/api/admin/upi_handles" ||
                    normalizedPath.startsWith("/api/user/upi") ||
                    normalizedPath === "/api/user/toggle_status"
                  ) {
                    const { handleP2pApi } = await import("./src/lib/p2p-api-handler.ts");
                    const p2pRes = await handleP2pApi(fetchReq.clone());
                    if (p2pRes) {
                      const resHeaders = {
                        ...Object.fromEntries(p2pRes.headers.entries()),
                        ...securityHeaders,
                      };
                      res.writeHead(p2pRes.status, resHeaders);
                      const p2pText = await p2pRes.text();
                      res.end(p2pText);
                      return;
                    }
                  }

                  // 3. Admin & System Database APIs
                  if (
                    normalizedPath.startsWith("/api/admin") ||
                    normalizedPath.startsWith("/api/auth") ||
                    normalizedPath === "/api/config" ||
                    normalizedPath === "/api/system_config" ||
                    normalizedPath === "/api/tools" ||
                    normalizedPath === "/api/v1/config" ||
                    normalizedPath === "/api/v1/gateways" ||
                    normalizedPath === "/api/v1/tools"
                  ) {
                    const { handleAdminDatabaseApi } =
                      await import("./src/lib/admin-database-api.ts");
                    const adminRes = await handleAdminDatabaseApi(fetchReq.clone());
                    if (adminRes) {
                      const resHeaders = {
                        ...Object.fromEntries(adminRes.headers.entries()),
                        ...securityHeaders,
                      };
                      res.writeHead(adminRes.status, resHeaders);
                      const adminText = await adminRes.text();
                      res.end(adminText);
                      return;
                    }
                  }

                  // 4. Orders & Auto-Withdraw APIs
                  if (
                    normalizedPath.startsWith("/api/v1/orders") ||
                    normalizedPath.startsWith("/api/orders") ||
                    normalizedPath.startsWith("/api/order") ||
                    normalizedPath.startsWith("/api/auto_withdraw") ||
                    normalizedPath.startsWith("/api/payments/initiate")
                  ) {
                    const { handleOrdersEngineApi } =
                      await import("./src/lib/orders-engine-api.ts");
                    const ordersRes = await handleOrdersEngineApi(fetchReq.clone());
                    if (ordersRes) {
                      const resHeaders = {
                        ...Object.fromEntries(ordersRes.headers.entries()),
                        ...securityHeaders,
                      };
                      res.writeHead(ordersRes.status, resHeaders);
                      const ordersText = await ordersRes.text();
                      res.end(ordersText);
                      return;
                    }
                  }

                  // 5. USDT Settlement APIs
                  if (normalizedPath.startsWith("/api/v1/usdt")) {
                    const { handleUsdtApi } = await import("./src/routes/usdtRoutes.js");
                    const usdtRes = await handleUsdtApi(fetchReq.clone());
                    if (usdtRes) {
                      const resHeaders = {
                        ...Object.fromEntries(usdtRes.headers.entries()),
                        ...securityHeaders,
                      };
                      res.writeHead(usdtRes.status, resHeaders);
                      const usdtText = await usdtRes.text();
                      res.end(usdtText);
                      return;
                    }
                  }

                  // 6. Live Payment RTDB Fallback
                  const { handleLivePaymentApi } = await import("./src/lib/live-payment-api.ts");
                  const liveRes = await handleLivePaymentApi(fetchReq.clone());
                  if (liveRes) {
                    const resHeaders = {
                      ...Object.fromEntries(liveRes.headers.entries()),
                      ...securityHeaders,
                    };
                    res.writeHead(liveRes.status, resHeaders);
                    const resText = await liveRes.text();
                    res.end(resText);
                    return;
                  }

                  // Unmatched API endpoint -> Return clean JSON 404 (NEVER HTML)
                  res.writeHead(404, {
                    "content-type": "application/json; charset=utf-8",
                    "cache-control": "no-store",
                    ...securityHeaders,
                  });
                  res.end(
                    JSON.stringify({
                      status: "error",
                      message: `API endpoint not found: ${normalizedPath}`,
                      error: `API endpoint not found: ${normalizedPath}`,
                      code: 404,
                      success: false,
                    }),
                  );
                } catch (e) {
                  const errMsg = e instanceof Error ? e.message : String(e);
                  res.writeHead(500, {
                    "content-type": "application/json; charset=utf-8",
                    ...securityHeaders,
                  });
                  res.end(
                    JSON.stringify({
                      status: "error",
                      message: errMsg,
                      error: errMsg,
                      code: 500,
                      success: false,
                    }),
                  );
                }
              };

              if (["GET", "HEAD"].includes(req.method || "")) {
                processApiRequest(Buffer.alloc(0));
                return;
              }

              const anyReq = req as unknown as {
                readableEnded?: boolean;
                body?: unknown;
                _body?: unknown;
                complete?: boolean;
                readable?: boolean;
                isPaused?: () => boolean;
                resume?: () => void;
              };

              const existingBody = anyReq.body !== undefined ? anyReq.body : anyReq._body;
              if (existingBody !== undefined && existingBody !== null) {
                const buf = Buffer.isBuffer(existingBody)
                  ? existingBody
                  : Buffer.from(
                      typeof existingBody === "string"
                        ? existingBody
                        : JSON.stringify(existingBody),
                    );
                processApiRequest(buf);
                return;
              }

              if (anyReq.readableEnded || (anyReq.complete && !anyReq.readable)) {
                processApiRequest(Buffer.alloc(0));
                return;
              }

              const chunks: Buffer[] = [];
              let handled = false;
              const trigger = (buf: Buffer) => {
                if (handled) return;
                handled = true;
                if (timeoutTimer) clearTimeout(timeoutTimer);
                processApiRequest(buf);
              };

              // Safety timeout: Never allow body stream to hang or drop connection (max 1200ms)
              const timeoutTimer = setTimeout(() => {
                if (!handled) {
                  trigger(Buffer.concat(chunks));
                }
              }, 1200);

              req.on("data", (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
              req.once("end", () => {
                trigger(Buffer.concat(chunks));
              });
              req.once("close", () => {
                trigger(Buffer.concat(chunks));
              });
              req.once("error", (err: Error) => {
                if (timeoutTimer) clearTimeout(timeoutTimer);
                res.writeHead(500, {
                  "content-type": "application/json; charset=utf-8",
                  ...securityHeaders,
                });
                res.end(
                  JSON.stringify({
                    status: "error",
                    message: err.message,
                    error: err.message,
                    success: false,
                  }),
                );
              });

              if (typeof anyReq.resume === "function") {
                anyReq.resume();
              }
              return;
            }

            return next();
          });
        },
      },
    ],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
