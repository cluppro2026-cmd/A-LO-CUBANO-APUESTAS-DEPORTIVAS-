export async function onRequestGet(context) {
  // Sincronizador de la MLB API Gratuita (No requiere API Key)
  const mlbUrl = "https://statsapi.mlb.com/api/v1/schedule?sportId=1";
  
  try {
    const res = await fetch(mlbUrl);
    const data = await res.json();

    return new Response(JSON.stringify({
      status: "synced",
      totalGamesToday: data.totalGames || 0,
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Error al sincronizar con MLB API" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
