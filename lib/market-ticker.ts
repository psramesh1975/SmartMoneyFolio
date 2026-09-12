// Server-side fetch for the dashboard's top market ticker strip (NIFTY 50,
// SENSEX, Gold 24K/10g, RBI Repo Rate). None of these live in our own
// database — there's no market-index or bullion-price model in the schema —
// so this hits free, keyless public endpoints instead of hardcoding the
// mockup's placeholder figures. Every field is nullable: a slow/blocked/
// down upstream must never break the dashboard, so callers render "—" for
// whatever didn't come back rather than a stale or fabricated number.
//
// Cached at the Next.js fetch layer for 5 minutes (revalidate: 300) — these
// are ambient context for a personal finance app, not a trading terminal;
// there's no need to hit upstream on every page view.

export type MarketTicker = {
  niftyPrice: number | null;
  niftyChangePct: number | null;
  sensexPrice: number | null;
  sensexChangePct: number | null;
  gold24kPer10g: number | null; // INR, derived (see getGold24kPer10gINR)
  repoRatePct: number; // see MANUAL_REPO_RATE_PCT below
};

const YAHOO_CHART_URL = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;

async function getYahooIndex(symbol: string): Promise<{ price: number | null; changePct: number | null }> {
  try {
    const res = await fetch(YAHOO_CHART_URL(symbol), {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return { price: null, changePct: null };
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = typeof meta?.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
    const changePct = typeof meta?.regularMarketChangePercent === "number" ? meta.regularMarketChangePercent : null;
    return { price, changePct };
  } catch {
    return { price: null, changePct: null };
  }
}

const TROY_OUNCE_IN_GRAMS = 31.1034768;

// Spot gold (XAU/USD, per troy ounce) x USD→INR, converted to a 24K-per-10g
// figure. This is a spot-price estimate, not a retail India bullion quote —
// real jewellers' rates add import duty/GST/making charges on top, so this
// will read a bit below what a buyer actually pays. Documented here rather
// than silently presented as a retail rate.
async function getGold24kPer10gINR(): Promise<number | null> {
  try {
    const [goldRes, fxRes] = await Promise.all([
      fetch("https://api.gold-api.com/price/XAU", { next: { revalidate: 300 } }),
      fetch("https://api.frankfurter.app/latest?from=USD&to=INR", { next: { revalidate: 300 } }),
    ]);
    if (!goldRes.ok || !fxRes.ok) return null;
    const gold = await goldRes.json();
    const fx = await fxRes.json();
    const usdPerOunce = typeof gold?.price === "number" ? gold.price : null;
    const usdToInr = typeof fx?.rates?.INR === "number" ? fx.rates.INR : null;
    if (usdPerOunce === null || usdToInr === null) return null;
    const inrPerGram = (usdPerOunce * usdToInr) / TROY_OUNCE_IN_GRAMS;
    return Math.round(inrPerGram * 10);
  } catch {
    return null;
  }
}

// The RBI Monetary Policy Committee's policy repo rate. There's no free
// public API for this (it changes only when the MPC meets, a handful of
// times a year) — update this constant when it does. Last checked against
// the RBI MPC announcement: 5.50%, effective from the June 2025 cut.
const MANUAL_REPO_RATE_PCT = 5.5;

export async function getMarketTicker(): Promise<MarketTicker> {
  const [nifty, sensex, gold24kPer10g] = await Promise.all([
    getYahooIndex("^NSEI"),
    getYahooIndex("^BSESN"),
    getGold24kPer10gINR(),
  ]);

  return {
    niftyPrice: nifty.price,
    niftyChangePct: nifty.changePct,
    sensexPrice: sensex.price,
    sensexChangePct: sensex.changePct,
    gold24kPer10g,
    repoRatePct: MANUAL_REPO_RATE_PCT,
  };
}
