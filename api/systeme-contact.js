// Endpoint Vercel pour créer/mettre à jour un contact Système.io + appliquer un tag
// IDs des tags intégrés en dur (plus simple à maintenir)

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

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Lecture body (parfois req.body est vide sur Vercel)
    let body = req.body;
    if (!body) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      body = raw ? JSON.parse(raw) : {};
    }

    const { email, lastName, creneau } = body || {};
    if (!email || !lastName || !creneau) {
      return res.status(400).json({ error: 'email, lastName et creneau sont requis', received: body });
    }

    const apiKey = process.env.SIO_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'SIO_API_KEY manquante (configure-la dans Vercel > Settings > Environment Variables)' });

    // Résolution de l'ID du tag
    const tagId = TAGS[creneau];
    if (!tagId) {
      return res.status(400).json({ error: 'Tag non configuré pour ce créneau', creneau });
    }

    // 1) Créer / mettre à jour le contact
    const createRes = await fetch(`${API_BASE}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        email,
        lastName
      })
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

    // 2) Assigner le tag
    const tagRes = await fetch(`${API_BASE}/api/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ tagId })
    });

    const tagText = await tagRes.text();
    if (!tagRes.ok) {
      console.error('Assignation tag échouée:', { status: tagRes.status, body: tagText.slice(0, 400) });
      return res.status(207).json({
        ok: true,
        warning: 'Contact créé, mais tag non appliqué',
        status: tagRes.status,
        response: tagText.slice(0, 400)
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('SERVER ERROR:', err);
    return res.status(500).json({ error: 'Erreur serveur', details: String(err?.message || err) });
  }
}
