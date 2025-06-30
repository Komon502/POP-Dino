import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For Next.js API routes, use req.query; for Vercel Edge, use req.url parsing
    let countryCode = req.query?.countryCode;
    if (!countryCode && req.url) {
      // fallback for Vercel/Node.js API routes
      const match = req.url.match(/\/country\/([^/?]+)/);
      if (match) countryCode = match[1];
    }

    if (!countryCode || countryCode.length !== 2) {
      return res.status(400).json({ error: 'Invalid country code' });
    }

    const country = countryCode.toUpperCase();
    const countryKey = `country:${country}`;

    // Get country score
    const total = (await kv.get(countryKey)) || 0;

    // Get rank
    const leaderboard = await getLeaderboard();
    const rank = calculateRank(country, leaderboard);

    // Add cache headers
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');

    res.status(200).json({
      country,
      total: parseInt(total, 10),
      rank
    });

  } catch (error) {
    console.error('Country API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getLeaderboard() {
  try {
    const keys = await kv.keys('country:*');
    const leaderboard = {};

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return leaderboard;
    }

    const scores = await Promise.all(keys.map(key => kv.get(key)));

    keys.forEach((key, index) => {
      const country = key.replace('country:', '');
      leaderboard[country] = parseInt(scores[index], 10) || 0;
    });

    return leaderboard;
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return {};
  }
}

function calculateRank(country, leaderboard) {
  const sortedCountries = Object.entries(leaderboard)
    .sort(([, a], [, b]) => b - a);

  const rank = sortedCountries.findIndex(([c]) => c === country) + 1;
  return rank > 0 ? rank : 0;
}