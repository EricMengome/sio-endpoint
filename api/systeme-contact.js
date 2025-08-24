// Endpoint serverless Vercel pour créer/mettre à jour un contact Système.io + appliquer un tag
// Variables d'environnement requises (Vercel > Settings > Environment Variables) :
// SIO_API_KEY, TAG_ENFANTS_SALON, TAG_TAI_CHI, TAG_ADULTES_SALON, TAG_ENFANTS_ALLEINS, TAG_ADULTES_MARSEILLE

function cors(res) {
  // Pour plus de sécurité, remplace '*' par l'URL de ta page Système.io
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end(); // préflight CORS
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, lastName, creneau } = req.body || {};
    if (!email || !lastName || !creneau) {
      return res.status(400).json({ error: 'email, lastName et creneau sont requis' });
    }

    const apiKey = process.env.SIO_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'SIO_API_KEY manquante' });

    // Mapping sélection -> ID de tag
    const TAG_MAP = {
      enfants_salon: process.env.TAG_ENFANTS_SALON,
      tai_chi_salon: process.env.TAG_TAI_CHI,
      adultes_salon: process.env.TAG_ADULTES_SALON,
      enfants_alleins: process.env.TAG_ENFANTS_ALLEINS,
      adultes_marseille: process.env.TAG_ADULTES_MARSEILLE
    };

    const tagId = TAG_MAP[creneau];
    if (!tagId) return res.status(400).json({ error: 'Tag non configuré pour ce créneau' });

    // 1) Créer / mettre à jour le contact
    const createRes = await fetch('https://api.systeme.io/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        email,
        lastName
        // Pour stocker le choix dans un champ personnalisé "creneau" (slug), dé-commente :
        // , fields: [{ slug: 'creneau', value: creneau }]
      })
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      return res.status(createRes.status).json({ error: createData?.message || 'Échec création/MAJ contact' });
    }

    const contactId = createData.id || createData.contact?.id;
    if (!contactId) return res.status(500).json({ error: "Impossible de récupérer l'ID du contact" });

    // 2) Assigner le tag
    const tagRes = await fetch(`https://api.systeme.io/api/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ tagId })
    });

    if (!tagRes.ok) {
      const t = await tagRes.text();
      console.error('Assignation tag échouée:', t);
      return res.status(207).json({ ok: true, warning: 'Contact créé, mais tag non appliqué' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
