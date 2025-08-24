// Endpoint Vercel pour créer/mettre à jour un contact Système.io + appliquer un tag
// IDs des tags intégrés en dur

const TAGS = {
  enfants_salon: 1614985,
  tai_chi_salon: 1614987,
  adultes_salon: 614988,
  enfants_alleins: 1614989,
  adultes_marseille: 1614990,
};

const API_BASE = 'https://api.systeme.io';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // tu peux restreindre à ton domaine SIO
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readBody(req) {
  if (req.body) return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
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
    if (!email || !lastName || !creneau) {
      return res.status(400).json({ error: 'email, lastName et creneau sont requis', received: body });
    }

    const apiKey = process.env.SIO_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'SIO_API_KEY manquante (Vercel > Settings > Environment Variables)' });
    }

    const tagId = TAGS[creneau];
    if (!tagId) {
      return res.status(400).json({ error: 'Tag non configuré pour ce créneau', creneau });
    }

    // 1) Créer / MAJ contact
    const createRes = await fetch(`${API_BASE}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ email, lastName })
    });

    const createText = await createRes.text();
    let createJson = null;
    try { createJson = JSON.parse(createText); } catch {}
    if (!createRes.ok) {
      return res.status(createRes.status).json({
        error: 'Échec création/MAJ contact',
        status: createRes.status,
        response: createJson || createText
      });
    }

    const contactId = (createJson && (createJson.id || createJson.contact?.id)) || null;
    if (!contactId) {
      return res.status(500).json({ error: "Impossible de récupérer l'ID du contact", response: createJson || createText });
    }

    // 2) Assigner le tag — on tente 2 formats : {tagId} puis {tag_id}
    // Essai A : camelCase
    const tryCamel = await fetch(`${API_BASE}/api/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ tagId: Number(tagId) })
    });
    if (tryCamel.ok) return res.status(200).json({ ok: true });

    const camelText = await tryCamel.text();

    // Essai B : snake_case
    const trySnake = await fetch(`${API_BASE}/api/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ tag_id: Number(tagId) })
    });
    if (trySnake.ok) return res.status(200).json({ ok: true });

    const snakeText = await trySnake.text();

    // Aucun des deux n'a marché → renvoyer les détails
    return res.status(207).json({
      ok: true,
      warning: 'Contact créé, mais tag non appliqué',
      attempts: {
        camelCase: { status: tryCamel.status, response: camelText.slice(0, 400) },
        snakeCase: { status: trySnake.status, response: snakeText.slice(0, 400) }
      }
    });

  } catch (err) {
    console.error('SERVER ERROR:', err);
    return res.status(500).json({ error: 'Erreur serveur', details: String(err?.message || err) });
  }
}
