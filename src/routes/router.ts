import { handleBestCard } from "./best-card";
import { handleCardDetail } from "./card";
import { handlePortfolioBest } from "./portfolio";
import { handleMerchantSearch } from "./search";
import { health } from "./health";
import { handleSyncSheets } from "./admin/sync-sheets";
import { handleAdminCards, handleAdminCardById } from "./admin/cards";
import { handleAdminBonusCategories } from "./admin/bonus-categories";
import { handleAdminMerchants } from "./admin/merchants";
import {
  handleTcStatus,
  handleTcScan,
  handleTcDebugFetch,
} from "./admin/tc-monitor";
import { handleMccLookup } from "./lookup";
import {
  handleSubmitFeedback,
  handleGetMessages,
  handleMarkMessageRead,
  handleDeleteMessage,
} from "./admin/messages";
import { APIError, ERROR_CODES } from "../lib/errors";

export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Health
  if (pathname === "/api/v1/health" && request.method === "GET") {
    return health(env);
  }

  // Admin: sync-sheets
  if (pathname === "/api/v1/admin/sync-sheets" && request.method === "POST") {
    return handleSyncSheets(request, env);
  }

  // Admin: T&C monitor — status (GET)
  if (pathname === "/api/v1/admin/tc/status" && request.method === "GET") {
    return handleTcStatus(env);
  }

  // Admin: T&C monitor — manual scan trigger (POST)
  if (pathname === "/api/v1/admin/tc/scan" && request.method === "POST") {
    return handleTcScan(request, env);
  }

  // Admin: T&C monitor — debug: test if outbound fetch works
  if (pathname === "/api/v1/admin/tc/test-fetch" && request.method === "GET") {
    const targetUrl =
      new URL(request.url).searchParams.get("url") ||
      "https://www.hsbc.com.sg/content/dam/hsbc/sg/documents/credit-cards/travelone/credit-card-reward-points-programme-terms-and-conditions.pdf";
    try {
      const res = await fetch(targetUrl, { method: "HEAD" });
      return Response.json({
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
      });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // Admin: T&C monitor — debug: fetch a card PDF and inspect content
  if (pathname === "/api/v1/admin/tc/debug-fetch" && request.method === "GET") {
    return handleTcDebugFetch(request, env);
  }

  // Admin: status
  if (pathname === "/api/v1/admin/status" && request.method === "GET") {
    const lastSync = await env.DB.prepare(
      `SELECT * FROM update_log ORDER BY created_at DESC LIMIT 1`,
    ).first();
    const counts = await env.DB.prepare(
      `
        SELECT
          (SELECT COUNT(*) FROM cards) as cards,
          (SELECT COUNT(*) FROM bonus_categories) as bonus_categories,
          (SELECT COUNT(*) FROM merchant_mappings) as merchant_mappings
      `,
    ).first();

    return Response.json({
      lastSync: lastSync?.created_at || null,
      counts,
      status: "ok",
    });
  }

  // Admin: list cards
  if (pathname === "/api/v1/admin/cards" && request.method === "GET") {
    return handleAdminCards(request, env);
  }

  // Admin: get/update single card
  const adminCardMatch = pathname.match(/^\/api\/v1\/admin\/cards\/(.+)$/);
  if (adminCardMatch && request.method === "GET") {
    return handleAdminCardById(request, env, adminCardMatch[1]);
  }
  if (adminCardMatch && request.method === "PUT") {
    return handleAdminCardById(request, env, adminCardMatch[1]);
  }

  // Admin: bonus categories
  if (
    pathname === "/api/v1/admin/bonus-categories" &&
    request.method === "GET"
  ) {
    return handleAdminBonusCategories(request, env);
  }
  if (
    pathname === "/api/v1/admin/bonus-categories" &&
    request.method === "PUT"
  ) {
    return handleAdminBonusCategories(request, env);
  }

  // Admin: merchants
  if (pathname === "/api/v1/admin/merchants" && request.method === "GET") {
    return handleAdminMerchants(request, env);
  }
  if (pathname === "/api/v1/admin/merchants" && request.method === "PUT") {
    return handleAdminMerchants(request, env);
  }

  // best-card
  if (pathname === "/api/v1/best-card" && request.method === "GET") {
    return handleBestCard(request, env);
  }

  // card detail
  const cardMatch = pathname.match(/^\/api\/v1\/card\/(.+)$/);
  if (cardMatch && request.method === "GET") {
    return handleCardDetail(request, env, cardMatch[1]);
  }

  // portfolio best
  if (pathname === "/api/v1/portfolio/best" && request.method === "GET") {
    return handlePortfolioBest(request, env);
  }

  // merchant search
  if (pathname === "/api/v1/search/merchants" && request.method === "GET") {
    return handleMerchantSearch(request, env);
  }

  // MCC lookup (wildcard merchant → category resolution)
  if (pathname === "/api/v1/lookup/mcc" && request.method === "GET") {
    return handleMccLookup(request, env);
  }

  // Public: submit feedback
  if (pathname === "/api/v1/feedback" && request.method === "POST") {
    return handleSubmitFeedback(request, env);
  }

  // Admin: messages
  const messageMatch = pathname.match(/^\/api\/v1\/admin\/messages(\/(.+))?$/);
  if (messageMatch && request.method === "GET") {
    return handleGetMessages(request, env);
  }
  if (messageMatch && request.method === "PUT" && messageMatch[2]) {
    return handleMarkMessageRead(request, env, messageMatch[2]);
  }
  if (messageMatch && request.method === "DELETE" && messageMatch[2]) {
    return handleDeleteMessage(request, env, messageMatch[2]);
  }

  return Response.json(
    {
      error: "NOT_FOUND",
      message: "Endpoint not found",
    },
    { status: 404 },
  );
}
