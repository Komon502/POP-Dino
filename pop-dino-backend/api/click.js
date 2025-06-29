import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { country, clicks, sessionId } = req.body;

        // Validation
        if (!country || !clicks || clicks <= 0 || clicks > 1000) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        // ใน click API - เพิ่ม rate limiting
        const rateLimitKey = `rate_limit:${ip}:${sessionId}`;
        const requests = await kv.incr(rateLimitKey);
        await kv.expire(rateLimitKey, 60);

        if (requests > 1000) {
            return res.status(429).json({ error: 'Too many requests' });
        }

        // Update country score
        const countryKey = `country:${country}`;
        const newTotal = await kv.incrby(countryKey, clicks);

        // Update rate limit
        await kv.setex(rateLimitKey, 60, recentClicks + clicks);

        // Calculate rank
        const leaderboard = await getLeaderboard();
        const rank = calculateRank(country, leaderboard);

        // Log for analytics (optional)
        await kv.lpush('click_log', JSON.stringify({
            country,
            clicks,
            sessionId,
            timestamp: Date.now(),
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
        }));

        res.status(200).json({
            success: true,
            countryTotal: newTotal,
            rank: rank
        });

    } catch (error) {
        console.error('Click API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getLeaderboard() {
    try {
        // Get all country keys
        const keys = await kv.keys('country:*');
        const leaderboard = {};

        // Get scores for all countries
        for (const key of keys) {
            const country = key.replace('country:', '');
            const score = await kv.get(key) || 0;
            leaderboard[country] = parseInt(score);
        }

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
    return rank || 0;
}