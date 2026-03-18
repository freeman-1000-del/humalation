const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Plan definitions
const PLANS = {
  basic_monthly: {
    name: 'HumaLation Basic',
    price: 990, // $9.90 in cents
    interval: 'month',
    languages: 40,
    description: '40 Languages + Auto YouTube Register'
  },
  pro_monthly: {
    name: 'HumaLation Pro',
    price: 3500, // $35.00 in cents
    interval: 'month',
    languages: 70,
    description: '70 Languages + 4 Bundle Tools'
  },
  lifetime: {
    name: 'HumaLation Lifetime',
    price: 29900, // $299.00 in cents
    interval: null,
    languages: 70,
    description: '70 Languages + All Tools Forever'
  }
};

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { planId, email } = req.body;
  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const origin = req.headers.origin || process.env.NEXT_PUBLIC_URL || 'https://humalation.vercel.app';

    let session;

    if (plan.interval) {
      // Recurring subscription
      const price = await stripe.prices.create({
        unit_amount: plan.price,
        currency: 'usd',
        recurring: { interval: plan.interval },
        product_data: { name: plan.name, description: plan.description }
      });

      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{ price: price.id, quantity: 1 }],
        customer_email: email || undefined,
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=${planId}`,
        cancel_url: `${origin}/#pricing`,
        metadata: { planId, languages: plan.languages.toString() },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      });
    } else {
      // One-time lifetime payment
      const price = await stripe.prices.create({
        unit_amount: plan.price,
        currency: 'usd',
        product_data: { name: plan.name, description: plan.description }
      });

      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{ price: price.id, quantity: 1 }],
        customer_email: email || undefined,
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=${planId}`,
        cancel_url: `${origin}/#pricing`,
        metadata: { planId, languages: plan.languages.toString() },
        allow_promotion_codes: true,
      });
    }

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
};
