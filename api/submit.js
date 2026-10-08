// Vercel / Netlify-compatible serverless handler (also used by our tiny Node server)
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.BREVO_KEY;

async function createContact(payload) {
  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { status: res.status, text };
}

// Vercel
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!BREVO_API_KEY) return res.status(500).json({ error: 'missing_api_key' });

  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { return res.status(400).json({ error: 'invalid' }); }
  }
  if (!data || !data.email) return res.status(400).json({ error: 'invalid' });

  const payload = {
    email: data.email,
    attributes: data.attributes || {},
    listIds: data.listIds || [9],
    updateEnabled: true,
  };

  const result = await createContact(payload);
  if (result.status === 201 || result.status === 204 || (result.status >= 200 && result.status < 300)) {
    return res.status(200).json({ ok: true });
  }
  return res.status(502).json({ error: 'brevo', status: result.status, body: result.text });
};
