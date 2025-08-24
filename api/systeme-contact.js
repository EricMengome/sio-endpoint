function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Tente de lire le body proprement même si non parsé
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
    if (!apiKey) return res.status(500).json({ error: 'SIO_API_KEY manquante' });

    const TAG_MAP = {
      enfants_salon: process.env.TAG_ENFANTS_SALON,
      tai_chi_salon: process.env.TAG_TAI_CHI,
      adultes_salon: process.env.TAG_ADULTES_SALON,
      enfants_alleins: process.env.TAG_ENFANTS_ALLEINS,
      adultes_marseille: process.env.TAG_ADULTES_MARSEILLE
    };
    const tagId = TAG_MAP[creneau];
    if (!tagId) return res.status(400).json({ error: 'Tag non configuré pour ce créneau', creneau });

    // 1) Création / MAJ contact — on remonte TOUT (status + body) si ça échoue
    const createRes = await fetch('https://api.systeme.io/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        email,
        lastName
        // , fields: [{ slug: 'creneau', value: creneau }] // si tu crées ce champ personnalisé
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

    // 2) Assignation du tag — on remonte aussi le détail
    const tagRes = await fetch(`https://api.systeme.io/api/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ tagId })
    });

    const tagText = await tagRes.text();
    if (!tagRes.ok) {
      return res.status(207).json({
        ok: true,
        warning: 'Contact créé, mais tag non appliqué',
        status: tagRes.status,
        response: tagText.slice(0, 400)
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur', details: String(err?.message || err) });
  }
}
