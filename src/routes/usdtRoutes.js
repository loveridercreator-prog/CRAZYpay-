/**
 * CRAZY PAY :: USDT PAYMENT ROUTES
 * ---------------------------------------------------------------------------
 * Maps endpoints for:
 *  - POST /api/v1/usdt/create-order
 *  - GET  /api/v1/usdt/check-status
 *  - POST /api/v1/usdt/verify-txhash
 * Provides both standard Express-style router middleware and universal Web API handlers.
 * ---------------------------------------------------------------------------
 */

import { UsdtController } from "../controllers/usdtController.js";

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
  "access-control-allow-headers":
    "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control",
  "access-control-expose-headers": "*",
  "access-control-max-age": "86400",
};

/**
 * Universal Web Fetch API Dispatcher for /api/v1/usdt/*
 * Handles standard Web Request / Response objects (used by Vite and TanStack Start)
 */
export async function handleUsdtApi(request) {
  const url = new URL(request.url);
  const rawPath = url.pathname;
  const path = rawPath.endsWith("/") && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;

  if (!path.startsWith("/api/v1/usdt")) {
    return null;
  }

  // Handle CORS Preflight immediately
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
      },
    });
  }

  // Adapter for Express-like controller methods
  let responseStatus = 200;
  let responseHeaders = {
    "content-type": "application/json",
    "cache-control": "no-store",
    ...CORS_HEADERS,
  };
  let responseBody = null;

  const mockRes = {
    status(code) {
      responseStatus = code;
      return mockRes;
    },
    json(data) {
      responseBody = JSON.stringify(data);
      return mockRes;
    },
    send(data) {
      responseBody = typeof data === "object" ? JSON.stringify(data) : String(data);
      return mockRes;
    },
    set(key, val) {
      responseHeaders[String(key).toLowerCase()] = val;
      return mockRes;
    },
    setHeader(key, val) {
      responseHeaders[String(key).toLowerCase()] = val;
      return mockRes;
    },
  };

  const queryParams = Object.fromEntries(url.searchParams.entries());

  let body = {};
  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    try {
      body = await request.clone().json();
    } catch (_e) {
      try {
        const text = await request.clone().text();
        body = text ? JSON.parse(text) : {};
      } catch (_e2) {
        body = {};
      }
    }
  }

  const mockReq = {
    method: request.method,
    url: request.url,
    query: queryParams,
    params: {},
    body,
    headers: Object.fromEntries(request.headers.entries()),
  };

  if (request.method === "POST" && path === "/api/v1/usdt/create-order") {
    await UsdtController.createOrder(mockReq, mockRes);
    return new Response(responseBody, { status: responseStatus, headers: responseHeaders });
  }

  if (request.method === "GET" && path === "/api/v1/usdt/check-status") {
    await UsdtController.checkStatus(mockReq, mockRes);
    return new Response(responseBody, { status: responseStatus, headers: responseHeaders });
  }

  if (request.method === "POST" && path === "/api/v1/usdt/verify-txhash") {
    await UsdtController.verifyTxHash(mockReq, mockRes);
    return new Response(responseBody, { status: responseStatus, headers: responseHeaders });
  }

  return null;
}

/**
 * Standard Express / Connect Middleware handler
 */
export async function expressUsdtMiddleware(req, res, next) {
  const url = (req.url || "").split("?")[0];
  const path = url.endsWith("/") && url.length > 1 ? url.slice(0, -1) : url;

  if (!path.startsWith("/api/v1/usdt")) {
    return next ? next() : undefined;
  }

  // Set CORS headers
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Parse body if not already parsed
  let body = req.body;
  if (!body && ["POST", "PUT", "PATCH"].includes(req.method)) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch (_e) {
      body = {};
    }
    req.body = body;
  }

  if (req.method === "POST" && path === "/api/v1/usdt/create-order") {
    await UsdtController.createOrder(req, res);
    return;
  }

  if (req.method === "GET" && path === "/api/v1/usdt/check-status") {
    await UsdtController.checkStatus(req, res);
    return;
  }

  if (req.method === "POST" && path === "/api/v1/usdt/verify-txhash") {
    await UsdtController.verifyTxHash(req, res);
    return;
  }

  if (next) next();
}

export default {
  handleUsdtApi,
  expressUsdtMiddleware,
  UsdtController,
  CORS_HEADERS,
};
