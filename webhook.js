const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PLAN_CONFIG = {
  basic_monthly:  { languages: 40, bundle: false, lifetime: false },
  pro_monthly:    { languages: 70, bundle: true,  lifetime: false },
  lifetime:       { languages: 70, bundle: true,  lifetime: true  },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw body needed - see vercel.json
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {

      // ── New subscription or one-time payment completed ──
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_email || session.customer_details?.email;
        const planId = session.metadata?.planId;
        const config = PLAN_CONFIG[planId];
        if (!email || !config) break;

        const expiresAt = config.lifetime
          ? null
          : new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(); // +32 days

        await supabase.from('users').upsert({
          email,
          plan: planId,
          languages: config.languages,
          bundle: config.bundle,
          lifetime: config.lifetime,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription || null,
          active: true,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });

        console.log(`✅ Activated: ${email} → ${planId}`);
        break;
      }

      // ── Subscription renewed ──
      case 'invoice.paid': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const newExpiry = new Date(invoice.lines.data[0]?.period?.end * 1000).toISOString();

        await supabase.from('users')
          .update({ active: true, expires_at: newExpiry, updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId);

        console.log(`🔄 Renewed: ${customerId}`);
        break;
      }

      // ── Subscription cancelled / payment failed ──
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj = event.data.object;
        const customerId = obj.customer;

        await supabase.from('users')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId);

        console.log(`❌ Deactivated: ${customerId}`);
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: err.message });
  }
};
