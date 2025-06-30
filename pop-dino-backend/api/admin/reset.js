import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse body if not already parsed (for Vercel, req.body may be undefined)
    let adminKey;
    if (req.body && typeof req.body === 'object') {
      adminKey = req.body.adminKey;
    } else {
      // Parse JSON body manually
      const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => {
          data += chunk;
        });
        req.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      adminKey = body.adminKey;
    }

    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Reset all country scores
    const keys = await kv.keys('country:*');

    if (keys.length > 0) {
      await Promise.all(keys.map(key => kv.del(key)));
    }

    // Clear logs
    await kv.del('click_log');

    res.status(200).json({
      success: true,
      message: 'All data reset successfully',
      resetCount: keys.length
    });

  } catch (error) {
    console.error('Reset API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}