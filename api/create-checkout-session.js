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

  // Build the absolute URL Stripe should send the customer back to.
  // VERCEL_URL is automatically provided by Vercel at runtime.
  const origin = req.headers.origin || `https://${process.env.VERCEL_URL || 'yourethestar.pro'}`;

  try {
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${origin}/?doc_success=1&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${origin}/?doc_cancelled=1`);
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', `Notice of Termination — "${title}"`);
    params.append('line_items[0][price_data][product_data][description]', `Draft document for ${artist}, registration ${reg}`);
    params.append('line_items[0][price_data][unit_amount]', '1900'); // $19.00 in cents
    params.append('line_items[0][quantity]', '1');

    // Stash everything we need to regenerate the document after payment.
    // Stripe metadata values must be strings.
