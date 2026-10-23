function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function buildMatchId(prefix, homeTeam, awayTeam, date) {
  const datePart = new Date(date).toISOString().slice(0, 10);
  return `${prefix}_${slugify(homeTeam)}_${slugify(awayTeam)}_${datePart}`;
}

async function fetchFootballDataMatches() {
  const res = await fetch("https://api.football-data.org/v4/competitions/PD/matches?status=SCHEDULED&limit=10", {
    headers: { "X-Auth-Token": "26649c1bb8fa4c11ba8a5c6ea393df58" }
  });

  if (!res.ok) {
    throw new Error(`football-data no disponible: ${res.status}`);
  }

  const data = await res.json();
  const matches = (data.matches || []).slice(0, 10).map((match) => {
    const home = match.homeTeam || {};
    const away = match.awayTeam || {};
    const homeName = home.shortName || home.name || "Local";
    const awayName = away.shortName || away.name || "Visitante";
    const date = match.utcDate || new Date().toISOString();

    return {
      id: buildMatchId("fb", homeName, awayName, date),
      sport: "FOOTBALL",
      league: match.competition?.name || "LaLiga",
      homeTeam: homeName,
      homeLogo: home.crest || "https://crests.football-data.org/86.png",
      awayTeam: awayName,
      awayLogo: away.crest || "https://crests.football-data.org/81.png",
      date,
      totalPool: 150.00
    };
  });

  return matches;
}

async function fetchEspnFootballMatches() {
  const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?limit=10");
  if (!res.ok) {
    throw new Error(`espn soccer no disponible: ${res.status}`);
  }

  const data = await res.json();
  const events = data.events || [];

  return events
    .filter((event) => event.date)
    .slice(0, 10)
    .map((event) => {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors || [];
      const home = competitors.find((slot) => slot.homeAway === "home") || competitors[0];
      const away = competitors.find((slot) => slot.homeAway === "away") || competitors[1] || competitors[0];

      if (!home || !away) return null;

      const homeTeam = home.team?.shortName || home.team?.displayName || "Local";
      const awayTeam = away.team?.shortName || away.team?.displayName || "Visitante";
      const date = event.date || new Date().toISOString();

      return {
        id: buildMatchId("fb", homeTeam, awayTeam, date),
        sport: "FOOTBALL",
        league: competition?.competition?.name || event.league?.name || "Premier League",
        homeTeam,
        homeLogo: home.team?.logos?.[0]?.href || "https://crests.football-data.org/86.png",
        awayTeam,
        awayLogo: away.team?.logos?.[0]?.href || "https://crests.football-data.org/81.png",
        date,
        totalPool: 150.00
      };
    })
    .filter(Boolean);
}

async function fetchMlbMatches() {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}`);
  if (!res.ok) {
    throw new Error(`mlb schedule no disponible: ${res.status}`);
  }

  const data = await res.json();
  const games = (data.dates || []).flatMap((day) => day.games || []).slice(0, 10);

  return games.map((game) => {
    const home = game.homeTeam || {};
    const away = game.awayTeam || {};
    const homeName = home.teamName || home.shortName || "Local";
    const awayName = away.teamName || away.shortName || "Visitante";
    const date = game.gameDate || new Date().toISOString();

    return {
      id: buildMatchId("bb", homeName, awayName, date),
      sport: "BASEBALL",
      league: "MLB Baseball",
      homeTeam: homeName,
      homeLogo: `https://www.mlbstatic.com/team-logos/${home.id}.svg`,
      awayTeam: awayName,
      awayLogo: `https://www.mlbstatic.com/team-logos/${away.id}.svg`,
      date,
      totalPool: 250.00
    };
  });
}

async function fetchEspnBaseballMatches() {
  const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard");
  if (!res.ok) {
    throw new Error(`espn baseball no disponible: ${res.status}`);
  }

  const data = await res.json();
  const events = data.events || [];

  return events
    .filter((event) => event.date)
    .slice(0, 10)
    .map((event) => {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors || [];
      const home = competitors.find((slot) => slot.homeAway === "home") || competitors[0];
      const away = competitors.find((slot) => slot.homeAway === "away") || competitors[1] || competitors[0];

      if (!home || !away) return null;

      const homeTeam = home.team?.shortName || home.team?.displayName || "Local";
      const awayTeam = away.team?.shortName || away.team?.displayName || "Visitante";
      const date = event.date || new Date().toISOString();

      return {
        id: buildMatchId("bb", homeTeam, awayTeam, date),
        sport: "BASEBALL",
        league: competition?.competition?.name || "MLB Baseball",
        homeTeam,
        homeLogo: home.team?.logos?.[0]?.href || "https://www.mlbstatic.com/team-logos/147.svg",
        awayTeam,
        awayLogo: away.team?.logos?.[0]?.href || "https://www.mlbstatic.com/team-logos/111.svg",
        date,
        totalPool: 250.00
      };
    })
    .filter(Boolean);
}

function dedupeMatches(matches) {
  const seen = new Set();
  return matches.filter((match) => {
    if (!match || !match.id || seen.has(match.id)) return false;
    seen.add(match.id);
    return true;
  });
}

export async function onRequestGet() {
  let footballMatches = [];
  let baseballMatches = [];

  try {
    const sources = await Promise.allSettled([
      fetchFootballDataMatches(),
      fetchEspnFootballMatches()
    ]);

    for (const result of sources) {
      if (result.status === "fulfilled") {
        footballMatches.push(...result.value);
      }
    }
  } catch (e) {
    console.error("Error cargando fútbol real:", e);
  }

  try {
    const sources = await Promise.allSettled([
      fetchMlbMatches(),
      fetchEspnBaseballMatches()
    ]);

    for (const result of sources) {
      if (result.status === "fulfilled") {
        baseballMatches.push(...result.value);
      }
    }
  } catch (e) {
    console.error("Error cargando béisbol real:", e);
  }

  footballMatches = dedupeMatches(footballMatches).slice(0, 6);
  baseballMatches = dedupeMatches(baseballMatches).slice(0, 6);

  if (footballMatches.length < 2 || baseballMatches.length < 2) {
    return new Response(JSON.stringify({
      error: "No hay cartelera real disponible en este momento. Intenta nuevamente en unos minutos.",
      footballMatches: footballMatches.length,
      baseballMatches: baseballMatches.length
    }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });
  }

  const allMatches = [...footballMatches, ...baseballMatches];

  return new Response(JSON.stringify(allMatches), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}
