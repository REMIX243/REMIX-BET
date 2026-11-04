
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = "https://remix243.github.io";

    const headers = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (origin && origin !== allowedOrigin) {
      return new Response(
        JSON.stringify({ error: "Origine non autorisée" }),
        { status: 403, headers }
      );
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("dateFrom");
    const to = url.searchParams.get("dateTo");

    if (!env.FOOTBALL_DATA_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Clé API non configurée" }),
        { status: 500, headers }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const apiUrl = new URL("https://api.football-data.org/v4/matches");
    apiUrl.searchParams.set("dateFrom", from || today);
    apiUrl.searchParams.set("dateTo", to || from || today);

    const result = await fetch(apiUrl, {
      headers: { "X-Auth-Token": env.FOOTBALL_DATA_TOKEN }
    });

    const data = await result.json();

    return new Response(JSON.stringify(data), {
      status: result.status,
      headers
    });
  }
};
                        
