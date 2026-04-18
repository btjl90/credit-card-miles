/**
 * KV storage helpers for T&C baseline persistence.
 *
 * Uses the existing CACHE KV namespace. Key shapes:
 *   tc:baseline:{cardId}  — last parsed structured terms (JSON)
 *   tc:lastscan:{cardId}  — ISO timestamp of last scan
 *   tc:lastfullscan       — ISO timestamp of last full scan run
 */

import type { KVNamespace } from "@cloudflare/workers-types";
import type { TcCard } from "./tc-cards";
import type { ParsedTerms } from "./tc-gemini";

const BASELINE_PREFIX = "tc:baseline:";
const LASTSCAN_PREFIX = "tc:lastscan:";
const LASTFULL_KEY = "tc:lastfullscan";

export interface ScanResult {
  cardId: string;
  changed: boolean;
  newTerms?: ParsedTerms;
  previousTerms?: ParsedTerms;
  error?: string;
}

/**
 * Get the stored baseline for a card.
 */
export async function getBaseline(
  kv: KVNamespace,
  cardId: string,
): Promise<ParsedTerms | null> {
  const raw = await kv.get(`${BASELINE_PREFIX}${cardId}`, "json");
  return raw as ParsedTerms | null;
}

/**
 * Save a new baseline for a card.
 */
export async function saveBaseline(
  kv: KVNamespace,
  cardId: string,
  terms: ParsedTerms,
): Promise<void> {
  await kv.put(`${BASELINE_PREFIX}${cardId}`, JSON.stringify(terms));
  await kv.put(`${LASTSCAN_PREFIX}${cardId}`, new Date().toISOString());
}

/**
 * Get the last scan timestamp for a card.
 */
export async function getLastScan(
  kv: KVNamespace,
  cardId: string,
): Promise<string | null> {
  return (await kv.get(`${LASTSCAN_PREFIX}${cardId}`)) ?? null;
}

/**
 * Record that a full scan run completed.
 */
export async function recordFullScan(kv: KVNamespace): Promise<void> {
  await kv.put(LASTFULL_KEY, new Date().toISOString());
}

/**
 * Get the last full scan timestamp.
 */
export async function getLastFullScan(kv: KVNamespace): Promise<string | null> {
  return (await kv.get(LASTFULL_KEY)) ?? null;
}

/**
 * Build a summary of all stored baselines — used in alert emails.
 */
export async function getAllBaselines(
  kv: KVNamespace,
): Promise<Record<string, ParsedTerms>> {
  const result: Record<string, ParsedTerms> = {};
  const list = await kv.list({ prefix: BASELINE_PREFIX });
  for (const key of list.keys) {
    const cardId = key.name.replace(BASELINE_PREFIX, "");
    const terms = (await kv.get(key.name, "json")) as ParsedTerms;
    result[cardId] = terms;
  }
  return result;
}
