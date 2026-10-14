import { createFileRoute } from "@tanstack/react-router";
import { handleLivePaymentApi } from "@/lib/live-payment-api";
import { handleOrdersEngineApi } from "@/lib/orders-engine-api";
import { handleUsdtApi, CORS_HEADERS } from "@/routes/usdtRoutes.js";
import { handleAdminDatabaseApi } from "@/lib/admin-database-api";
import { handleP2pApi } from "@/lib/p2p-api-handler";
import { handleP2pEngineApi } from "@/lib/p2p-engine-api";

async function proxy({ request }: { request: Request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
      },
    });
  }

  try {
    const incoming = new URL(request.url);
    const cleanPath = incoming.pathname.replace(/\/+$/, "") || "/";

    // 1. P2P Engine, Provider Connections (MobiKwik/Payment Gateways), & Marketplace APIs
    if (
      cleanPath.startsWith("/api/v1/providers") ||
      cleanPath.startsWith("/api/v1/auth") ||
      cleanPath.startsWith("/api/v1/accounts") ||
      cleanPath.startsWith("/api/v1/marketplace") ||
      cleanPath.startsWith("/api/v1/trades") ||
      cleanPath.startsWith("/api/v1/engine") ||
      cleanPath.startsWith("/api/v1/verification")
    ) {
      const engineResponse = await handleP2pEngineApi(request.clone());
      if (engineResponse) {
        const headers = new Headers(engineResponse.headers);
        for (const [k, v] of Object.entries(CORS_HEADERS)) {
          headers.set(k, v);
        }
        headers.set("content-type", "application/json; charset=utf-8");
        return new Response(engineResponse.body, {
          status: engineResponse.status,
          statusText: engineResponse.statusText,
          headers,
        });
      }
    }

    // 2. Admin System, Database, Gateway & Config APIs
    if (
      cleanPath.startsWith("/api/admin") ||
      cleanPath.startsWith("/api/auth") ||
      cleanPath === "/api/config" ||
      cleanPath === "/api/system_config" ||
      cleanPath === "/api/tools" ||
      cleanPath === "/api/v1/config" ||
      cleanPath === "/api/v1/gateways" ||
      cleanPath === "/api/v1/tools"
    ) {
      const adminResponse = await handleAdminDatabaseApi(request.clone());
      if (adminResponse) {
        const headers = new Headers(adminResponse.headers);
        for (const [k, v] of Object.entries(CORS_HEADERS)) {
          headers.set(k, v);
        }
        headers.set("content-type", "application/json; charset=utf-8");
        return new Response(adminResponse.body, {
          status: adminResponse.status,
          statusText: adminResponse.statusText,
          headers,
        });
      }
    }

    // 3. Authoritative Triple-Layer P2P Verification Engine & Supabase API
    if (
      cleanPath.startsWith("/api/v1/p2p") ||
      cleanPath === "/api/v1/orders/verify-utr" ||
      cleanPath === "/api/fetch_upi" ||
      cleanPath === "/api/fetch-upi" ||
      cleanPath === "/api/get-upi" ||
      cleanPath === "/api/get_upi" ||
      cleanPath === "/api/upi" ||
      cleanPath === "/api/upi_handles" ||
      cleanPath === "/api/admin/upi_handles" ||
      cleanPath.startsWith("/api/user/upi") ||
      cleanPath === "/api/user/toggle_status"
    ) {
      const p2pResponse = await handleP2pApi(request.clone());
      if (p2pResponse) {
        const headers = new Headers(p2pResponse.headers);
        for (const [k, v] of Object.entries(CORS_HEADERS)) {
          headers.set(k, v);
        }
        headers.set("content-type", "application/json; charset=utf-8");
        return new Response(p2pResponse.body, {
          status: p2pResponse.status,
          statusText: p2pResponse.statusText,
          headers,
        });
      }
    }

    // 4. USDT Settlement & Gateway
    if (cleanPath.startsWith("/api/v1/usdt")) {
      const usdtResponse = await handleUsdtApi(request.clone());
      if (usdtResponse) {
        const headers = new Headers(usdtResponse.headers);
        for (const [k, v] of Object.entries(CORS_HEADERS)) {
          headers.set(k, v);
        }
        headers.set("content-type", "application/json; charset=utf-8");
        return new Response(usdtResponse.body, {
          status: usdtResponse.status,
          statusText: usdtResponse.statusText,
          headers,
        });
      }
    }

    // 5. Orders Engine
    if (
      cleanPath.startsWith("/api/v1/orders") ||
      cleanPath.startsWith("/api/orders") ||
      cleanPath.startsWith("/api/order") ||
      cleanPath.startsWith("/api/auto_withdraw") ||
      cleanPath.startsWith("/api/payments/initiate")
    ) {
      const ordersResponse = await handleOrdersEngineApi(request.clone());
      if (ordersResponse) {
        const headers = new Headers(ordersResponse.headers);
        for (const [k, v] of Object.entries(CORS_HEADERS)) {
          headers.set(k, v);
        }
        headers.set("content-type", "application/json; charset=utf-8");
        return new Response(ordersResponse.body, {
          status: ordersResponse.status,
          statusText: ordersResponse.statusText,
          headers,
        });
      }
    }

    // 6. Live Payment RTDB Engine
    const liveResponse = await handleLivePaymentApi(request.clone());
    if (liveResponse) {
      const headers = new Headers(liveResponse.headers);
      for (const [k, v] of Object.entries(CORS_HEADERS)) {
        headers.set(k, v);
      }
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(liveResponse.body, {
        status: liveResponse.status,
        statusText: liveResponse.statusText,
        headers,
      });
    }

    // Unmatched API endpoint -> Return clean JSON 404 (NEVER HTML)
    return Response.json(
      {
        status: "error",
        message: `API endpoint not found: ${cleanPath}`,
        error: `Endpoint '${cleanPath}' does not exist on this server.`,
        code: 404,
        success: false,
      },
      {
        status: 404,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          ...CORS_HEADERS,
        },
      },
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        status: "error",
        message: errMsg,
        error: errMsg,
        code: 500,
        success: false,
      },
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          ...CORS_HEADERS,
        },
      },
    );
  }
}

export const Route = createFileRoute("/api/$")({
  component: () => null,
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
      PUT: proxy,
      PATCH: proxy,
      DELETE: proxy,
      OPTIONS: proxy,
    },
  },
});
