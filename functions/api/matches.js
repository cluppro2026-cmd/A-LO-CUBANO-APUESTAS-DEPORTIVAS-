export async function onRequestGet(context) {
  const FOOTBALL_API_KEY = "26649c1bb8fa4c11ba8a5c6ea393df58";
  
  let footballMatches = [];

  // 1. Consultar partidos reales de Fútbol desde Football-Data.org
  try {
    const res = await fetch("https://api.football-data.org/v4/matches", {
      headers: { "X-Auth-Token": FOOTBALL_API_KEY }
    });

    if (res.ok) {
      const data = await res.json();
      footballMatches = (data.matches || []).slice(0, 5).map(m => ({
        id: `fb_${m.id}`,
        sport: "FOOTBALL",
        league: m.competition ? m.competition.name : "Fútbol Top",
        homeTeam: m.homeTeam.name,
        homeLogo: m.homeTeam.crest || "https://crests.football-data.org/86.png",
        awayTeam: m.awayTeam.name,
        awayLogo: m.awayTeam.crest || "https://crests.football-data.org/81.png",
        date: m.utcDate,
        totalPool: 100.00
      }));
    }
  } catch (e) {
    console.log("Error consultando API de Fútbol, cargando respaldo.");
  }

  // Si la API no devuelve partidos hoy o da error, cargamos respaldo
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

  // 2. Partidos de Béisbol MLB
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
    },
    {
      id: "bb_2",
      sport: "BASEBALL",
      league: "MLB Béisbol",
      homeTeam: "LA Dodgers",
      homeLogo: "https://www.mlbstatic.com/team-logos/119.svg",
      awayTeam: "SF Giants",
      awayLogo: "https://www.mlbstatic.com/team-logos/137.svg",
      date: new Date(Date.now() + 300 * 60000).toISOString(),
      totalPool: 195.00
    }
  ];

  // Unir listas
  const allMatches = [...footballMatches, ...baseballMatches];

  return new Response(JSON.stringify(allMatches), {
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
