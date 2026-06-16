// /api/create-checkout-session.js
//
// This runs on Vercel automatically (no server for Kirk to manage).
// It creates a Stripe Checkout Session for the $19 document unlock,
// and stores which song the person is buying a document for in the
// session metadata, so we know what to generate after they pay.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured on the server yet.' });
  }

  const { title, artist, year, reg, opens, closes, claimantName, claimantRole, format } = req.body || {};

  if (!title || !artist || !reg) {
    return res.status(400).json({ error: 'Missing required song information.' });
  }

  const origin = req.headers.origin || `https://${process.env.VERCEL_URL || 'yourethestar.pro'}`;

  try {
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${origin}/?doc_success=1&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${origin}/?doc_cancelled=1`);
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', `Notice of Termination — "${title}"`);
    params.append('line_items[0][price_data][product_data][description]', `Draft document for ${artist}, registration ${reg}`);
    params.append('line_items[0][price_data][unit_amount]', '1900');
    params.append('line_items[0][quantity]', '1');

    params.append('metadata[title]', title);
    params.append('metadata[artist]', artist);
    params.append('metadata[year]', String(year || ''));
    params.append('metadata[reg]', reg);
    params.append('metadata[opens]', String(opens || ''));
    params.append('metadata[closes]', String(closes || ''));
    params.append('metadata[claimantName]', claimantName || '');
    params.append('metadata[claimantRole]', claimantRole || '');
    params.append('metadata[format]', format || 'docx');

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error('Stripe error:', session);
      return res.status(500).json({ error: session.error?.message || 'Stripe could not create a checkout session.' });
    }

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('Checkout session error:', err);
    return res.status(500).json({ error: 'Something went wrong creating your checkout session.' });
  }
}
