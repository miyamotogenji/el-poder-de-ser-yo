// Vercel serverless: create Brevo contact + optional payment proof email
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.BREVO_KEY;
const NOTIFY_TO = process.env.NOTIFY_EMAIL || 'todosabordocr@gmail.com';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'todosabordocr@gmail.com';
const SENDER_NAME = process.env.SENDER_NAME || 'Todos a Bordo CR';

async function brevoFetch(path, body) {
  const res = await fetch('https://api.brevo.com/v3' + path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

function safeName(name) {
  return String(name || 'comprobante.pdf').replace(/[^\w.\-]+/g, '_').slice(0, 80);
}

async function notifyWithAttachment(data) {
  const attrs = data.attributes || {};
  const html = `
    <p><strong>Nueva inscripción — El Poder de Ser Yo</strong></p>
    <ul>
      <li>Nombre: ${attrs.NOMBRE_COMPLETO || ''}</li>
      <li>Email: ${data.email || ''}</li>
      <li>WhatsApp: ${attrs.TELEFONO_WHATSAPP || ''}</li>
      <li>País: ${attrs.PAIS || ''}</li>
      <li>Rol: ${attrs.ROL || ''}</li>
      <li>Hijos: ${attrs.CANTIDAD_HIJOS || ''} — ${attrs.EDAD_HIJOS || ''}</li>
      <li>Interés: ${attrs.INTERES_TALLER || ''}</li>
      <li>Fuente: ${attrs.COMO_ENTERASTE || ''}</li>
      <li>Recibir info: ${attrs.RECIBIR_INFO || ''}</li>
      <li>Pregunta: ${attrs.PREGUNTA_ABIERTA || ''}</li>
    </ul>
    <p>${data.comprobante ? 'Comprobante de pago adjunto.' : 'Sin comprobante adjunto.'}</p>
  `;

  const body = {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: NOTIFY_TO }],
    subject: 'Inscripción taller + comprobante — El Poder de Ser Yo',
    htmlContent: html,
  };

  if (data.comprobante && data.comprobante.content) {
    body.attachment = [
      {
        content: data.comprobante.content,
        name: safeName(data.comprobante.name),
      },
    ];
  }

  return brevoFetch('/smtp/email', body);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!BREVO_API_KEY) return res.status(500).json({ error: 'missing_api_key' });

  let data = req.body;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return res.status(400).json({ error: 'invalid' });
    }
  }
  if (!data || !data.email) return res.status(400).json({ error: 'invalid' });

  const contactPayload = {
    email: data.email,
    attributes: data.attributes || {},
    listIds: data.listIds || [9],
    updateEnabled: true,
  };

  const contact = await brevoFetch('/contacts', contactPayload);
  const contactOk =
    contact.status === 201 ||
    contact.status === 204 ||
    (contact.status >= 200 && contact.status < 300);

  if (!contactOk) {
    return res.status(502).json({ error: 'brevo', status: contact.status, body: contact.text });
  }

  // Always notify Gustavo; attach file when present
  try {
    await notifyWithAttachment(data);
  } catch (e) {
    // Contact already saved — don't fail the whole submission
  }

  return res.status(200).json({ ok: true });
};
