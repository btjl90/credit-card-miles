/**
 * T&C Monitor — Cloudflare Workers Cron Trigger
 *
 * Runs monthly via wrangler.toml cron trigger: `0 9 1 * *` (9am SGT on the 1st).
 * Also callable manually via POST /api/v1/admin/tc/scan.
 *
 * Cards are read from the database at runtime — no hardcoded list.
 * Only cards with a valid PDF in tnc_url are monitored.
 */

import type { Env } from "../../index";
import type { TcCard } from "../../lib/tc-cards";
import {
  getBaseline,
  saveBaseline,
  recordFullScan,
  getLastFullScan,
  getAllBaselines,
} from "../../lib/tc-storage";
import { parseTermsWithGemini, compareTerms } from "../../lib/tc-gemini";
import { sendChangeAlert, sendScanReport } from "../../lib/tc-alerts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DbCard {
  card_id: string;
  card_name: string;
  bank: string;
  tnc_url: string | null;
}

/**
 * Fetch all monitorable cards from the database.
 * Only returns cards that have a non-empty tnc_url.
 */
async function getDbCards(env: Env): Promise<TcCard[]> {
  const result = await env.DB.prepare(
    "SELECT card_id, card_name, bank, tnc_url FROM cards WHERE tnc_url IS NOT NULL AND tnc_url != ''",
  ).all<DbCard>();

  return result.results
    .filter((row) => row.tnc_url)
    .map((row) => ({
      id: row.card_id,
      name: row.card_name,
      bank: row.bank,
      pdfUrl: row.tnc_url!,
    }));
}

// ---------------------------------------------------------------------------
// Scheduled handler (called by wrangler.toml cron trigger)
// ---------------------------------------------------------------------------

export async function handleTcCron(
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const start = Date.now();
  console.log("T&C cron: scan started");

  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("T&C cron: GOOGLE_API_KEY not set — aborting scan");
    return;
  }

  const webhookUrl = env.TC_DISCORD_WEBHOOK_URL;
  const cards = await getDbCards(env);
  console.log(`T&C cron: found ${cards.length} cards to monitor`);

  const results: Array<{
    cardId: string;
    changed: boolean;
    error?: string;
  }> = [];

  for (const card of cards) {
    try {
      console.log(`T&C cron: scanning ${card.id}`);
      const oldTerms = await getBaseline(env.CACHE, card.id);

      // Parse new terms from PDF using Gemini
      const newTerms = await parseTermsWithGemini(
        card.pdfUrl,
        card.name,
        card.bank,
        apiKey,
      );

      if (oldTerms) {
        // Compare with baseline
        const comparison = await compareTerms(oldTerms, newTerms, apiKey);
        if (comparison.changed) {
          console.warn(`T&C cron: CHANGE detected for ${card.id}`);
          await saveBaseline(env.CACHE, card.id, newTerms);
          results.push({ cardId: card.id, changed: true });

          // Send change alert to Discord
          if (webhookUrl) {
            try {
              await sendChangeAlert(webhookUrl, {
                cardName: card.name,
                bank: card.bank,
                summary: comparison.summary,
                oldTerms: comparison.oldTerms,
                newTerms: comparison.newTerms,
              });
              console.log(`T&C cron: Discord alert sent for ${card.id}`);
            } catch (err) {
              console.error(
                `T&C cron: Discord alert failed for ${card.id}:`,
                err,
              );
            }
          }
        } else {
          results.push({ cardId: card.id, changed: false });
        }
      } else {
        // First scan — save baseline, no alert
        await saveBaseline(env.CACHE, card.id, newTerms);
        results.push({ cardId: card.id, changed: false });
        console.log(`T&C cron: baseline saved for ${card.id} (first scan)`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`T&C cron: error scanning ${card.id}:`, msg);
      results.push({ cardId: card.id, changed: false, error: msg });
    }
  }

  await recordFullScan(env.CACHE);

  const changedCount = results.filter((r) => r.changed).length;
  const errorCount = results.filter((r) => r.error).length;

  // Post scan summary to Discord
  if (webhookUrl) {
    try {
      await sendScanReport(webhookUrl, {
        totalCards: cards.length,
        scannedCards: results.length,
        changedCards: changedCount,
        errors: results
          .filter((r) => r.error)
          .map((r) => ({ cardId: r.cardId, error: r.error! })),
      });
      console.log("T&C cron: Discord summary posted");
    } catch (err) {
      console.error("T&C cron: Discord summary failed:", err);
    }
  }

  const elapsed = Date.now() - start;
  console.log(
    `T&C cron: scan complete in ${elapsed}ms — ${changedCount} changes, ${errorCount} errors`,
  );
}

// ---------------------------------------------------------------------------
// Manual trigger (POST /api/v1/admin/tc/scan)
// ---------------------------------------------------------------------------

export async function handleTcScan(
  request: Request,
  env: Env,
): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  if (token !== (env.JWT_SECRET ?? "dev-secret")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GOOGLE_API_KEY not configured" },
      { status: 500 },
    );
  }

  const cards = await getDbCards(env);

  const results: Array<{
    cardId: string;
    name: string;
    changed: boolean;
    error?: string;
    summary?: string;
  }> = [];

  for (const card of cards) {
    try {
      const oldTerms = await getBaseline(env.CACHE, card.id);
      const newTerms = await parseTermsWithGemini(
        card.pdfUrl,
        card.name,
        card.bank,
        apiKey,
      );

      if (oldTerms) {
        const comparison = await compareTerms(oldTerms, newTerms, apiKey);
        if (comparison.changed) {
          await saveBaseline(env.CACHE, card.id, newTerms);
          results.push({
            cardId: card.id,
            name: card.name,
            changed: true,
            summary: comparison.summary,
          });
        } else {
          results.push({ cardId: card.id, name: card.name, changed: false });
        }
      } else {
        await saveBaseline(env.CACHE, card.id, newTerms);
        results.push({ cardId: card.id, name: card.name, changed: false });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        cardId: card.id,
        name: card.name,
        changed: false,
        error: msg,
      });
    }
  }

  await recordFullScan(env.CACHE);

  return Response.json({
    scanned: results.length,
    results,
    scannedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Status endpoint (GET /api/v1/admin/tc/status)
// ---------------------------------------------------------------------------

export async function handleTcStatus(env: Env): Promise<Response> {
  const baselines = await getAllBaselines(env.CACHE);
  const lastFullScan = await getLastFullScan(env.CACHE);
  const cards = await getDbCards(env);

  const cardStatus = cards.map((card) => {
    const baseline = baselines[card.id];
    return {
      id: card.id,
      name: card.name,
      bank: card.bank,
      tncUrl: card.pdfUrl,
      hasBaseline: !!baseline,
      parsedAt: baseline?.parsedAt ?? null,
    };
  });

  return Response.json({
    cards: cardStatus,
    lastFullScan,
    totalMonitored: cards.length,
  });
}

// ---------------------------------------------------------------------------
// Debug: fetch a card PDF and return metadata (GET /api/v1/admin/tc/debug-fetch)
// ---------------------------------------------------------------------------

export async function handleTcDebugFetch(
  request: Request,
  env: Env,
): Promise<Response> {
  const cardId = new URL(request.url).searchParams.get("cardId");
  const directUrl = new URL(request.url).searchParams.get("url");

  let url = directUrl ?? "";
  let label = cardId ?? "direct";

  if (!url && cardId) {
    const cards = await getDbCards(env);
    const card = cards.find((c) => c.id === cardId);
    if (card) {
      url = card.pdfUrl;
      label = card.name;
    } else {
      return Response.json(
        { error: `Card '${cardId}' not found` },
        { status: 404 },
      );
    }
  }

  if (!url) {
    return Response.json(
      { error: "Missing cardId or url param" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(url);
    const clone = response.clone();
    const text = await response.text();
    const arrayBuffer = await clone.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer.slice(0, 100));
    const base64Sample = btoa(
      bytes.reduce((data, byte) => data + String.fromCharCode(byte), ""),
    );

    return Response.json({
      label,
      url,
      ok: response.ok,
      status: response.status,
      contentLength: arrayBuffer.byteLength,
      contentType: response.headers.get("content-type"),
      bodyPreview: text.slice(0, 200),
      base64Prefix: base64Sample,
    });
  } catch (e) {
    return Response.json({ label, url, error: String(e) }, { status: 500 });
  }
}
