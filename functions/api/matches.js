export async function onRequestGet(context) {
  const matches = [
    {
      id: "m1",
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
      id: "m2",
      sport: "FOOTBALL",
      league: "Premier League",
      homeTeam: "Manchester City",
      homeLogo: "https://crests.football-data.org/65.png",
      awayTeam: "Arsenal FC",
      awayLogo: "https://crests.football-data.org/57.png",
      date: new Date(Date.now() + 45 * 60000).toISOString(), // Bloqueado (<60 min)
      totalPool: 180.00
    },
    {
      id: "m3",
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

  return new Response(JSON.stringify(matches), {
    headers: { "Content-Type": "application/json" }
  });
}
