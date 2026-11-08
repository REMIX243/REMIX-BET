const API_BASE = "https://api.football-data.org/v4";

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

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return json({ error: "Méthode non autorisée." }, 405, corsHeaders);
    }

    if (!env.FOOTBALL_DATA_TOKEN) {
      return json({
        error: "Configuration manquante : FOOTBALL_DATA_TOKEN."
      }, 500, corsHeaders);
    }

    const incoming = new URL(request.url);
    const action = incoming.searchParams.get("action");

    let endpoint;

    if (action === "competitions") {
      endpoint = `${API_BASE}/competitions`;
    } else if (action === "team-matches") {
      const teamId = incoming.searchParams.get("teamId");

      if (!teamId || !/^\d+$/.test(teamId)) {
        return json({ error: "Identifiant d'équipe invalide." }, 400, corsHeaders);
      }

      const params = new URLSearchParams({
        status: "FINISHED",
        limit: "10"
      });

      endpoint = `${API_BASE}/teams/${teamId}/matches?${params}`;
    } else {
      const dateFrom = incoming.searchParams.get("dateFrom");
      const dateTo = incoming.searchParams.get("dateTo");
      const competition = incoming.searchParams.get("competition");

      if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
        return json({
          error: "Dates invalides. Format attendu : AAAA-MM-JJ."
        }, 400, corsHeaders);
      }

      if (dateFrom > dateTo) {
        return json({
          error: "La date de début doit précéder la date de fin."
        }, 400, corsHeaders);
      }

      const params = new URLSearchParams({
        dateFrom,
        dateTo
      });

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

      const body = await response.text();

      let data;
      try {
        data = JSON.parse(body);
      } catch {
        data = { message: body };
      }

      if (!response.ok) {
        return json({
          error: "Le fournisseur de données a refusé la demande.",
          providerStatus: response.status,
          details: data
        }, response.status, corsHeaders);
      }

      return json(data, 200, corsHeaders);

    } catch (error) {
      return json({
        error: "Impossible de contacter le fournisseur de matchs.",
        details: error.message
      }, 502, corsHeaders);
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
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}
