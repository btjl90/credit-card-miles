/**
 * Alerting via Discord webhooks.
 * Free — no server, no email domain needed. Just a Discord channel + webhook URL.
 *
 * Setup:
 *  1. Open Discord → right-click your channel (or create a new one) → Edit Channel
 *  2. Go to Integrations → Webhooks → New Webhook → Copy Webhook URL
 *  3. Set `wrangler secret put TC_DISCORD_WEBHOOK_URL` to that URL
 */

export interface ChangeAlert {
  cardName: string;
  bank: string;
  summary: string;
  oldTerms: unknown;
  newTerms: unknown;
}

export interface ScanReport {
  totalCards: number;
  scannedCards: number;
  changedCards: number;
  errors: Array<{ cardId: string; error: string }>;
}

/**
 * Send a Discord embed message via webhook.
 */
async function sendDiscord(webhookUrl: string, payload: object): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook error: ${response.status} ${body}`);
  }
}

/**
 * Post a change alert to Discord.
 */
export async function sendChangeAlert(
  webhookUrl: string,
  alert: ChangeAlert,
): Promise<void> {
  const embed = {
    title: `T&C Changed: ${alert.cardName}`,
    color: 0xffa500, // orange
    fields: [
      {
        name: "Bank",
        value: alert.bank,
        inline: true,
      },
      {
        name: "Summary",
        value: alert.summary,
        inline: false,
      },
    ],
    footer: {
      text: "BestMiles T&C Monitor",
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscord(webhookUrl, {
    username: "BestMiles T&C",
    avatar_url: "https://bestmiles.pages.dev/icon.png",
    embeds: [embed],
  });
}

/**
 * Post a scan summary report to Discord.
 */
export async function sendScanReport(
  webhookUrl: string,
  report: ScanReport,
): Promise<void> {
  const changedColor = report.changedCards > 0 ? 0xff0000 : 0x28a745; // red if changes, green if clean
  const statusEmoji = report.changedCards > 0 ? "⚠️" : "✅";

  const fields = [
    {
      name: "Cards Scanned",
      value: `${report.scannedCards} / ${report.totalCards}`,
      inline: true,
    },
    {
      name: "Changes Detected",
      value: `${report.changedCards}`,
      inline: true,
    },
  ];

  if (report.errors.length > 0) {
    fields.push({
      name: "Errors",
      value: report.errors.map((e) => `• ${e.cardId}: ${e.error}`).join("\n"),
      inline: false,
    });
  }

  const embed = {
    title: `${statusEmoji} Monthly T&C Scan Complete`,
    color: changedColor,
    fields,
    footer: {
      text: "BestMiles T&C Monitor",
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscord(webhookUrl, {
    username: "BestMiles T&C",
    avatar_url: "https://bestmiles.pages.dev/icon.png",
    embeds: [embed],
  });
}
