// /api/verify-session.js
//
// When Stripe redirects someone back to the site after payment, the URL
// includes a session_id. This function asks Stripe directly "did this
// session actually get paid?" — we never trust the URL alone, since
// someone could type a fake session_id and try to skip payment.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured on the server yet.' });
  }

  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).json({ error: 'Missing session_id.' });
  }

  try {
    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}`,
      { headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` } }
    );
    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return res.status(404).json({ paid: false, error: 'Session not found.' });
    }

    const paid = session.payment_status === 'paid';

    return res.status(200).json({
      paid,
      metadata: paid ? session.metadata : null,
    });
  } catch (err) {
    console.error('Verify session error:', err);
    return res.status(500).json({ paid: false, error: 'Could not verify payment.' });
  }
}
