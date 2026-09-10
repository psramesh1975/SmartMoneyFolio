// Dual-source stock/ETF price lookup — Yahoo Finance primary, Finnhub
// fallback on timeout/error — isolated here so swapping/adding providers
// later doesn't touch the sync route itself. Mutual fund NAVs are a
// separate, single-source lookup (mfapi.in, the AMFI-backed public API).

export async function fetchLatestPrice(ticker: string): Promise<number | null> {
  try {
    const price = await fetchFromYahoo(ticker);
    if (price !== null) return price;
  } catch {
    // fall through to Finnhub
  }
  try {
    return await fetchFromFinnhub(ticker);
  } catch {
    return null;
  }
}

// 5-second timeout specifically because this is an undocumented endpoint
// with no uptime guarantee — the sync job needs to give up quickly and fall
// through to Finnhub rather than hang the whole sync run.
async function fetchFromYahoo(ticker: string): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromFinnhub(ticker: string): Promise<number | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.c ?? null; // 'c' = current price
}

export async function fetchLatestNav(schemeCode: string): Promise<number | null> {
  const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.[0]?.nav ? Number(data.data[0].nav) : null;
}
