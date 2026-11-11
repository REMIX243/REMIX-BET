
const API_BASE = "https://api.football-data.org/v4";
const OPENAI_URL = "https://api.openai.com/v1/responses";

const ALLOWED_ORIGINS = [
  "https://remix243.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:5500"
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0];

    const headers = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    if (url.pathname === "/ai-analysis") {
      if (request.method !== "POST") {
        return json({ error: "Méthode non autorisée." }, 405, headers);
      }

      if (!env.OPENAI_API_KEY) {
        return json({ error: "Clé IA OPENAI_API_KEY non configurée." }, 500, headers);
      }

      try {
        const body = await request.json();

        if (!body.match || !body.homeRecent || !body.awayRecent) {
          return json({ error: "Données du match incomplètes." }, 400, headers);
        }

        const prompt = `
Tu es l'analyste football de REMIX BET.
Analyse uniquement les données fournies. Ne fabrique aucune statistique.

MATCH :
${JSON.stringify(body.match)}

10 DERNIERS MATCHS DOMICILE :
${JSON.stringify(body.homeRecent)}

10 DERNIERS MATCHS EXTÉRIEUR :
${JSON.stringify(body.awayRecent)}

Produis une analyse en français avec :
1. Forme récente des deux équipes.
2. Forces et faiblesses observées.
3. Probabilités estimées 1, N, 2.
4. Double chance 1X, X2 et 12.
5. Plus de 2,5 et moins de 2,5 buts.
6. Les deux équipes marquent : oui ou non.
7. Trois scores exacts possibles avec prudence.
8. Sélection statistiquement la plus intéressante.
9. Niveau de confiance : faible, moyen ou élevé.
10. Raisons et limites de l'analyse.

Les probabilités doivent être cohérentes et totaliser environ 100 % pour 1/N/2.
N'invente pas les blessures, compositions ou actualités non fournies.
Si les données sont insuffisantes, indique-le clairement.
Ne garantis jamais un résultat.
`;

        const aiResponse = await fetch(OPENAI_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-6-astra",
            input: prompt,
            max_output_tokens: 1600
          })
        });

        const result = await aiResponse.json();

        if (!aiResponse.ok) {
          return json({
            error: "Le service IA a refusé la demande.",
            details: result.error?.message || "Erreur du fournisseur IA."
          }, aiResponse.status, headers);
        }

        const answer = (result.output || [])
          .filter(item => item.type === "message")
          .flatMap(item => item.content || [])
          .filter(item => item.type === "output_text")
          .map(item => item.text)
          .join("\n");

        if (!answer) {
          return json({ error: "L'IA n'a pas retourné de texte." }, 502, headers);
        }

        return json({ success: true, analysis: answer }, 200, headers);

      } catch (error) {
        return json({ error: error.message }, 500, headers);
      }
    }

    if (request.method !== "GET") {
      return json({ error: "Méthode non autorisée." }, 405, headers);
    }

    if (!env.FOOTBALL_DATA_TOKEN) {
      return json({ error: "FOOTBALL_DATA_TOKEN manquant." }, 500, headers);
    }

    const action = url.searchParams.get("action");
    let endpoint;

    if (action === "team-matches") {
      const teamId = url.searchParams.get("teamId");

      if (!teamId || !/^\d+$/.test(teamId)) {
        return json({ error: "Identifiant d'équipe invalide." }, 400, headers);
      }

      endpoint = `${API_BASE}/teams/${teamId}/matches?status=FINISHED&limit=10`;

    } else {
      const dateFrom = url.searchParams.get("dateFrom");
      const dateTo = url.searchParams.get("dateTo");

      if (!isValidDate(dateFrom) || !isValidDate(dateTo) || dateFrom > dateTo) {
        return json({ error: "Dates invalides." }, 400, headers);
      }

      const params = new URLSearchParams({ dateFrom, dateTo });
      const competition = url.searchParams.get("competition");

      if (competition && /^[A-Z0-9,]+$/.test(competition)) {
        params.set("competitions", competition);
      }

      endpoint = `${API_BASE}/matches?${params}`;
    }

    try {
      const response = await fetch(endpoint, {
        headers: {
          "X-Auth-Token": env.FOOTBALL_DATA_TOKEN,
          "Accept": "application/json"
        }
      });

      const data = await response.json();
      return json(data, response.status, headers);

    } catch (error) {
      return json({ error: error.message }, 502, headers);
    }
  }
};

function isValidDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
      }
      
