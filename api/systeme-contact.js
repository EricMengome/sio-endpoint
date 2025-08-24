// Endpoint Vercel minimal : crée/MAJ un contact Système.io
// Nécessite la variable d'env SIO_API_KEY (dans Vercel > Settings > Environment Variables)

const API_BASE = 'https://api.systeme.io';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // tu peux restreindre à ton domaine SIO
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readBody(req) {
  if (req.body) return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const { email, lastName, creneau } = body || {};

    if (!email || !lastName) {
      return res.status(400).json({ error: 'email et lastName sont requis', received: body });
    }

    const apiKey = process.env.SIO_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'SIO_API_KEY manquante' });

    // Prépare le payload de création/MAJ contact
    const payload = { email, lastName };

    // OPTIONNEL : si tu crées un champ personnalisé "creneau" côté SIO (slug exact "creneau"),
    // décommente la ligne ci-dessous pour enregistrer la valeur du menu dans le contact :
    // if (creneau) payload.fields = [{ slug: 'creneau', value: creneau }];

    const createRes = await fetch(`${API_BASE}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(payload)
    });

    const text = await createRes.text();
    let json = null; try { json = JSON.parse(text); } catch {}

    if (!createRes.ok) {
      return res.status(createRes.status).json({
        error: 'Échec création/MAJ contact',
        status: createRes.status,
        response: json || text
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', details: String(err?.message || err) });
  }
}
