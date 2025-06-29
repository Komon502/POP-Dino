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
        const leaderboard = await getLeaderboard();

        // Add cache headers
        // ใน leaderboard API
        res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');

        res.status(200).json({
            leaderboard,
            lastUpdated: Date.now()
        });

    } catch (error) {
        console.error('Leaderboard API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getLeaderboard() {
    try {
        const keys = await kv.keys('country:*');
        const leaderboard = {};

        // Use pipeline for better performance
        const pipeline = [];
        for (const key of keys) {
            pipeline.push(kv.get(key));
        }

        const scores = await Promise.all(pipeline);

        keys.forEach((key, index) => {
            const country = key.replace('country:', '');
            leaderboard[country] = parseInt(scores[index]) || 0;
        });

        return leaderboard;
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        return {};
    }
}