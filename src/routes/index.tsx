import { createFileRoute } from "@tanstack/react-router";
import html from "../../public/index.html?raw";

// The original Crazy Pay site is served verbatim at "/".
export const Route = createFileRoute("/")({
  component: CrazyPayApp,
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");
        const wantsJson = (request.headers.get("accept") || "").includes("application/json");

        if (isApi || wantsJson) {
          return Response.json(
            {
              status: "error",
              message: `API endpoint not found: ${url.pathname}`,
              error: `API endpoint '${url.pathname}' was not recognized.`,
              code: 404,
              success: false,
            },
            {
              status: 404,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "access-control-allow-origin": "*",
                "cache-control": "no-store",
              },
            },
          );
        }

        return new Response(html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});

function CrazyPayApp() {
  return null;
}
