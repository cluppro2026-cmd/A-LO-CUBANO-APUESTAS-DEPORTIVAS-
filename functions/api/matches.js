export async function onRequestGet(context) {
  const FOOTBALL_API_KEY = "26649c1bb8fa4c11ba8a5c6ea393df58";
  let footballMatches = [];

  // 1. Intentar consultar partidos reales desde la API externa de Fútbol
  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/PD/matches?status=SCHEDULED", {
      headers: { "X-Auth-Token": FOOTBALL_API_KEY }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.matches && data.matches.length > 0) {
        footballMatches = data.matches.slice(0, 5).map(m => ({
          id: `fb_${m.id}`,
          sport: "FOOTBALL",
          league: m.competition ? m.competition.name : "LaLiga España",
          homeTeam: m.homeTeam.shortName || m.homeTeam.name,
          homeLogo: m.homeTeam.crest || "https://crests.football-data.org/86.png",
          awayTeam: m.awayTeam.shortName || m.awayTeam.name,
          awayLogo: m.awayTeam.crest || "https://crests.football-data.org/81.png",
          date: m.utcDate,
          totalPool: 150.00
        }));
      }
    }
  } catch (e) {
    console.log("Error consultando API de Fútbol:", e);
  }

  // 2. Si la API no devuelve partidos hoy o falla, cargar respaldo garantizado
  if (footballMatches.length === 0) {
    footballMatches = [
      {
        id: "fb_demo1",
        sport: "FOOTBALL",
        league: "LaLiga España",
        homeTeam: "Real Madrid",
        homeLogo: "https://crests.football-data.org/86.png",
        awayTeam: "FC Barcelona",
        awayLogo: "https://crests.football-data.org/81.png",
        date: new Date(Date.now() + 180 * 60000).toISOString(),
        totalPool: 250.00
      },
      {
        id: "fb_demo2",
        sport: "FOOTBALL",
        league: "Premier League",
        homeTeam: "Manchester City",
        homeLogo: "https://crests.football-data.org/65.png",
        awayTeam: "Arsenal FC",
        awayLogo: "https://crests.football-data.org/57.png",
        date: new Date(Date.now() + 45 * 60000).toISOString(),
        totalPool: 180.00
      }
    ];
  }

  // 3. Partidos de Béisbol MLB
  const baseballMatches = [
    {
      id: "bb_1",
      sport: "BASEBALL",
      league: "MLB Béisbol",
      homeTeam: "NY Yankees",
      homeLogo: "https://www.mlbstatic.com/team-logos/147.svg",
      awayTeam: "Boston Red Sox",
      awayLogo: "https://www.mlbstatic.com/team-logos/111.svg",
      date: new Date(Date.now() + 240 * 60000).toISOString(),
      totalPool: 320.00
    }
  ];

  const allMatches = [...footballMatches, ...baseballMatches];

  return new Response(JSON.stringify(allMatches), {
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache"
    }
  });
}
