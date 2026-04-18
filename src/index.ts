import { handleRequest } from "./routes/router";
import { handleTcCron } from "./routes/admin/tc-monitor";
import { rateLimit } from "./middleware/rate-limit";
import { APIError } from "./lib/errors";

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  JWT_SECRET?: string;
  GOOGLE_SHEETS_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  TC_DISCORD_WEBHOOK_URL?: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Apply rate limiting to API routes
    if (url.pathname.startsWith("/api/")) {
      const limit = url.pathname.startsWith("/api/v1/admin/") ? 60 : 100;
      const rateLimited = await rateLimit(request, env, limit);
      if (rateLimited) return rateLimited;
    }

    try {
      const response = await handleRequest(request, env, ctx);
      // Add CORS headers
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }
      return response;
    } catch (e) {
      if (e instanceof APIError) {
        return Response.json(
          { error: e.code, message: e.message },
          { status: e.status },
        );
      }
      console.error("Unhandled error:", e);
      return Response.json(
        {
          error: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
        { status: 500 },
      );
    }
  },

  // Cloudflare Cron trigger — runs the T&C monitor monthly
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    await handleTcCron(env, ctx);
  },
};
