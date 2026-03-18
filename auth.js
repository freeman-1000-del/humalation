const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, action } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    // Get user from DB
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.json({
        authenticated: false,
        plan: 'free',
        languages: 5,
        bundle: false,
        monthlyLimit: 3,
        usageCount: 0
      });
    }

    // Check expiry
    const isExpired = user.expires_at && new Date(user.expires_at) < new Date();
    if (isExpired && !user.lifetime) {
      await supabase.from('users').update({ active: false }).eq('email', email);
      return res.json({ authenticated: true, plan: 'expired', active: false });
    }

    // Check usage limit for basic plan
    if (action === 'translate' && user.plan === 'basic_monthly') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);

      const { count } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('email', email)
        .gte('created_at', startOfMonth.toISOString());

      if (count >= 50) {
        return res.json({ authenticated: true, plan: user.plan, active: user.active, limitReached: true });
      }

      // Log usage
      await supabase.from('usage_logs').insert({ email, action: 'translate' });
    }

    res.json({
      authenticated: true,
      plan: user.plan,
      languages: user.languages,
      bundle: user.bundle,
      lifetime: user.lifetime,
      active: user.active,
      expiresAt: user.expires_at,
    });

  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: err.message });
  }
};
