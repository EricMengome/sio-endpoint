// Endpoint Vercel minimal : crée/MAJ un contact Système.io
const API_BASE = 'https://api.systeme.io';
...
const { email, lastName, creneau } = body || {};

if (!email || !lastName) {           // ← la version minimale NE vérifie PAS "creneau"
  return res.status(400).json({ error: 'email et lastName sont requis', received: body });
}

// OPTIONNEL : champ personnalisé "creneau"
// if (creneau) payload.fields = [{ slug: 'creneau', value: creneau }];
