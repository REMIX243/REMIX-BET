
export default {
 async fetch(request, env) {
  const allowedOrigin = "https://remix243.github.io";
  const origin = request.headers.get("Origin") || "";

  const headers = {
   "Access-Control-Allow-Origin": allowedOrigin,
   "Access-Control-Allow-Methods": "GET, OPTIONS",
   "Access-Control-Allow-Headers": "Content-Type",
   "Content-Type": "application/json",
   "Cache-Control": "no-store"
  };

  if (request.method === "OPTIONS") {
   return new Response(null,{headers});
  }

  if (origin && origin !== allowedOrigin) {
   return new Response(JSON.stringify({
    error:"Origine non autorisée"
   }),{status:403,headers});
  }

  if (!env.FOOTBALL_DATA_TOKEN) {
   return new Response(JSON.stringify({
    error:"Clé API non configurée"
   }),{status:500,headers});
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  let api;

  if (action === "team-matches") {
   const id = url.searchParams.get("teamId");

   if (!id || !/^\d+$/.test(id)) {
    return new Response(JSON.stringify({
     error:"Identifiant équipe invalide"
    }),{status:400,headers});
   }

   api = new URL(
    `https://api.football-data.org/v4/teams/${id}/matches`
   );

   api.searchParams.set("status","FINISHED");
   api.searchParams.set("limit","10");

  } else {
   const from = url.searchParams.get("dateFrom");
   const to = url.searchParams.get("dateTo");

   if (!from || !to ||
       !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
       !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
       to < from) {
    return new Response(JSON.stringify({
     error:"Dates invalides"
    }),{status:400,headers});
   }

   api = new URL(
    "https://api.football-data.org/v4/matches"
   );

   api.searchParams.set("dateFrom",from);
   api.searchParams.set("dateTo",to);
  }

  try {
   const response = await fetch(api.toString(),{
    headers:{
     "X-Auth-Token":env.FOOTBALL_DATA_TOKEN
    }
   });

   const data = await response.text();

   return new Response(data,{
    status:response.status,
    headers
   });

  } catch(error) {
   return new Response(JSON.stringify({
    error:"Erreur de connexion au fournisseur",
    message:error.message
   }),{status:502,headers});
  }
 }
};
