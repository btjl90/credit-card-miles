/**
 * Card registry for T&C monitoring.
 * Each card has a human-readable name and the PDF URL for its terms.
 *
 * Add new cards here — the monitor will automatically pick them up.
 */

export interface TcCard {
  id: string; // unique, used as KV key prefix
  name: string; // display name e.g. "HSBC TravelOne"
  bank: string; // e.g. "HSBC"
  pdfUrl: string; // direct URL to the T&C PDF
  lastUpdatedUrl?: string; // optional: card product page with PDF link
}

export const TC_CARDS: TcCard[] = [
  {
    id: "hsbc-travelone",
    name: "HSBC TravelOne",
    bank: "HSBC",
    // Earn rates + bonus categories: reward points programme T&C
    pdfUrl:
      "https://www.hsbc.com.sg/content/dam/hsbc/sg/documents/credit-cards/travelone/credit-card-reward-points-programme-terms-and-conditions.pdf",
  },
  {
    id: "hsbc-revolution",
    name: "HSBC Revolution",
    bank: "HSBC",
    // Earn rates + bonus categories: reward points T&C
    pdfUrl:
      "https://www.hsbc.com.sg/content/dam/hsbc/sg/documents/credit-cards/revolution/offers/revolution-credit-card-reward-points-terms-and-conditions.pdf",
  },
  {
    id: "dbs-womens",
    name: "DBS Women's Card",
    bank: "DBS",
    pdfUrl:
      "https://www.dbs.com.sg/iwov-resources/media/pdf/cards/dbs-womans-card-tnc.pdf",
  },
  {
    id: "dbs-womens-world",
    name: "DBS Women's World Card",
    bank: "DBS",
    // Shares PDF with DBS Women's Card — Gemini extracts each card's section
    pdfUrl:
      "https://www.dbs.com.sg/iwov-resources/media/pdf/cards/dbs-womans-card-tnc.pdf",
  },
];

export function getCardById(id: string): TcCard | undefined {
  return TC_CARDS.find((c) => c.id === id);
}
