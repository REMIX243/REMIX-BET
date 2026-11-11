
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

    // ANALYSE IA
    if (url.pathname === "/ai-analysis") {
      if (request.method !== "POST") {
        return json({ error: "Méthode non autorisée." }, 405, headers);
      }

      if (!env.OPENAI_API_KEY) {
        return json({
          error: "Clé OPENAI_API_KEY absente de Cloudflare."
        }, 500, headers);
      }

      try {
        const body = await request.json();

        if (!body.match || !body.homeRecent || !body.awayRecent) {
          return json({
            error: "Données du match incomplètes."
          }, 400, headers);
        }

        const prompt = `
Tu es l'analyste football de REMIX BET.

Analyse uniquement les données fournies.
N'invente aucune statistique.

MATCH :
${JSON.stringify(body.match)}

10 DERNIERS MATCHS DOMICILE :
${JSON.stringify(body.homeRecent)}

10 DERNIERS MATCHS EXTÉRIEUR :
${JSON.stringify(body.awayRecent)}

Rédige en français :

1. Forme récente des deux équipes.
2. Forces et faiblesses.
3. Probabilités estimées 1, N, 2.
4. Double chance 1X, X2 et 12.
5. Plus de 2,5 et moins de 2,5 buts.
6. Les deux équipes marquent : oui ou non.
7. Trois scores exacts possibles.
8. Sélection statistiquement intéressante.
9. Niveau de confiance faible, moyen ou élevé.
10. Raisons et limites de l'analyse.

Les probabilités 1, N et 2 doivent totaliser environ 100 %.
Signale les données insuffisantes.
Ne garantis jamais un résultat.
`;

        console.log("REMIX BET : demande d'analyse IA reçue.");

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
          }),
          signal: AbortSignal.timeout(60000)
        });

        const result = await aiResponse.json();

        if (!aiResponse.ok) {
          console.error("Erreur OpenAI :", result);

          return json({
            error: "Erreur du service IA.",
            details: result.error?.message || JSON.stringify(result)
          }, aiResponse.status, headers);
        }

        // Récupération du texte de la réponse
        let answer = result.output_text || "";

        // Compatibilité avec les réponses détaillées
        if (!answer && Array.isArray(result.output)) {
          answer = result.output
            .filter(item => item.type === "message")
            .flatMap(item => item.content || [])
            .filter(item => item.type === "output_text")
            .map(item => item.text)
            .join("\n");
        }

        if (!answer) {
          console.error("Réponse IA sans texte :", result);

          return json({
            error: "L'IA n'a retourné aucun texte.",
            details: result.status || "Réponse vide"
          }, 502, headers);
        }

        console.log("REMIX BET : analyse IA terminée.");

        return json({
          success: true,
          analysis: answer
        }, 200, headers);

      } catch (error) {
        console.error("Erreur analyse IA :", error);

        return json({
          error: "Impossible de terminer l'analyse.",
          details: error.message
        }, 500, headers);
      }
    }

    // MATCHS FOOTBALL
    if (request.method !== "GET") {
      return json({
        error: "Méthode non autorisée."
      }, 405, headers);
    }

    if (!env.FOOTBALL_DATA_TOKEN) {
      return json({
        error: "FOOTBALL_DATA_TOKEN manquant."
      }, 500, headers);
    }

    const action = url.searchParams.get("action");
    let endpoint;

    if (action === "team-matches") {
      const teamId = url.searchParams.get("teamId");

      if (!teamId || !/^\d+$/.test(teamId)) {
        return json({
          error: "Identifiant d'équipe invalide."
        }, 400, headers);
      }

      endpoint =
        `${API_BASE}/teams/${teamId}/matches?status=FINISHED&limit=10`;

    } else {
      const dateFrom = url.searchParams.get("dateFrom");
      const dateTo = url.searchParams.get("dateTo");

      if (
        !isValidDate(dateFrom) ||
        !isValidDate(dateTo) ||
        dateFrom > dateTo
      ) {
        return json({
          error: "Dates invalides."
        }, 400, headers);
      }

      const params = new URLSearchParams({
        dateFrom,
        dateTo
      });

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
      console.error("Erreur Football Data :", error);

      return json({
        error: error.message
      }, 502, headers);
    }
  }
};

function isValidDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
  }
