import { kv } from '@vercel/kv';

export default async function handler(req, res) {
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
        // Get recent clicks (last 100)
        const recentClicks = await kv.lrange('click_log', 0, 99);

        // Get total clicks across all countries
        const leaderboard = await getLeaderboard();
        const totalClicks = Object.values(leaderboard).reduce((sum, score) => sum + score, 0);

        // Calculate clicks per hour
        const hourlyStats = calculateHourlyStats(recentClicks);

        res.status(200).json({
            totalClicks,
            activeCountries: Object.keys(leaderboard).length,
            hourlyStats,
            topCountries: Object.entries(leaderboard)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([country, score]) => ({ country, score }))
        });

    } catch (error) {
        console.error('Analytics API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getLeaderboard() {
    const keys = await kv.keys('country:*');
    const leaderboard = {};

    for (const key of keys) {
        const country = key.replace('country:', '');
        const score = await kv.get(key);
        leaderboard[country] = parseInt(score, 10) || 0;
    }

    return leaderboard;
}

function calculateHourlyStats(recentClicks) {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    let hourlyClicks = 0;
    for (const clickStr of recentClicks) {
        try {
            const click = JSON.parse(clickStr);
            if (click && click.timestamp && (now - click.timestamp) < oneHour) {
                hourlyClicks++;
            }
        } catch (e) {
            // Ignore malformed entries
        }
    }

    return {
        lastHour: hourlyClicks,
        clicksPerMinute: Math.round(hourlyClicks / 60)
    };
}
