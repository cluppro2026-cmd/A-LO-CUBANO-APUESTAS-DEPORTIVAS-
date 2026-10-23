const STORE = globalThis.__vcup_store || (globalThis.__vcup_store = {
  users: new Map(),
  bets: new Map()
});

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function asNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function ensureUser(email) {
  const key = normalizeEmail(email);
  if (!key) throw new Error('Email requerido');

  if (!STORE.users.has(key)) {
    STORE.users.set(key, { email: key, balance: 0 });
  }

  return STORE.users.get(key);
}

function getUserBets(email) {
  const key = normalizeEmail(email);
  return STORE.bets.get(key) || [];
}

function saveUserBets(email, bets) {
  STORE.bets.set(normalizeEmail(email), bets);
}

function isLockedByTime(matchDate) {
  if (!matchDate) return true;
  const matchTime = new Date(matchDate).getTime();
  if (!Number.isFinite(matchTime)) return true;
  return (matchTime - Date.now()) <= (60 * 60 * 1000);
}

async function fetchFootballResults() {
  const response = await fetch('https://api.football-data.org/v4/competitions/PD/matches?status=FINISHED&limit=50', {
    headers: { 'X-Auth-Token': '26649c1bb8fa4c11ba8a5c6ea393df58' }
  });

  if (!response.ok) {
    throw new Error(`football-data no disponible: ${response.status}`);
  }

  const data = await response.json();
  const results = new Map();

  for (const match of data.matches || []) {
    const winner = match?.score?.winner;
    const outcome = winner === 'HOME_TEAM' ? 'HOME' : winner === 'AWAY_TEAM' ? 'AWAY' : 'DRAW';
    results.set(`fb_${match.id}`, { sport: 'FOOTBALL', outcome });
  }

  return results;
}

async function fetchBaseballResults() {
  const today = new Date().toISOString().slice(0, 10);
  const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}`);

  if (!response.ok) {
    throw new Error(`mlb no disponible: ${response.status}`);
  }

  const data = await response.json();
  const results = new Map();

  for (const day of data.dates || []) {
    for (const game of day.games || []) {
      const home = game?.teams?.home;
      const away = game?.teams?.away;
      if (!home || !away) continue;
      const outcome = home.isWinner ? 'HOME' : away.isWinner ? 'AWAY' : 'DRAW';
      const key = `bb_${game.gamePk || game.id || Date.now()}`;
      results.set(key, { sport: 'BASEBALL', outcome });
    }
  }

  return results;
}

async function buildResultsMap() {
  const [football, baseball] = await Promise.all([
    fetchFootballResults().catch(() => new Map()),
    fetchBaseballResults().catch(() => new Map())
  ]);

  return new Map([...football, ...baseball]);
}

export async function onRequestGet(request) {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get('email'));

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const user = ensureUser(email);
  const bets = getUserBets(email).slice().reverse();

  return new Response(JSON.stringify({ success: true, user, bets }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase();
    const email = normalizeEmail(body.email || body.userEmail);

    if (action === 'register' || action === 'init-user') {
      const user = ensureUser(email);
      return new Response(JSON.stringify({ success: true, user }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'place') {
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email requerido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const user = ensureUser(email);
      const amount = asNumber(body.amount);
      const matchId = String(body.matchId || '').trim();
      const choice = String(body.choice || '').trim().toUpperCase();
      const matchDate = body.matchDate || body.date;

      if (!matchId || !choice || amount <= 0) {
        return new Response(JSON.stringify({ error: 'Datos de apuesta inválidos' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (isLockedByTime(matchDate)) {
        return new Response(JSON.stringify({ error: 'Apuestas cerradas para este partido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (user.balance < amount) {
        return new Response(JSON.stringify({ error: 'Saldo insuficiente' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      user.balance -= amount;
      const list = getUserBets(email);
      const bet = {
        id: `bet_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        userEmail: email,
        matchId,
        choice,
        amount,
        sport: String(body.sport || 'FOOTBALL').toUpperCase(),
        matchDate,
        settled: false,
        createdAt: new Date().toISOString()
      };
      list.push(bet);
      saveUserBets(email, list);

      return new Response(JSON.stringify({ success: true, user, bet }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'settle') {
      const targetEmail = email || normalizeEmail(body.targetEmail);
      const emails = targetEmail ? [targetEmail] : [...STORE.users.keys()];
      const results = await buildResultsMap();
      const balanceUpdates = {};
      const settledMatchIds = [];

      for (const userEmail of emails) {
        const user = ensureUser(userEmail);
        const bets = getUserBets(userEmail);
        const unsettled = bets.filter((bet) => !bet.settled);

        for (const bet of unsettled) {
          const result = results.get(String(bet.matchId));
          if (!result) continue;

          const related = unsettled.filter((item) => item.matchId === bet.matchId);
          const matchPool = related.reduce((sum, item) => sum + asNumber(item.amount), 0);
          const winners = related.filter((item) => item.choice === result.outcome);
          const totalWinners = winners.reduce((sum, item) => sum + asNumber(item.amount), 0);

          if (totalWinners > 0) {
            const distributable = matchPool * 0.90;
            for (const winner of winners) {
              const share = asNumber(winner.amount) / totalWinners;
              const payout = share * distributable;
              user.balance += payout;
              balanceUpdates[userEmail] = (balanceUpdates[userEmail] || 0) + payout;
            }
          } else {
            for (const item of related) {
              user.balance += asNumber(item.amount);
              balanceUpdates[userEmail] = (balanceUpdates[userEmail] || 0) + asNumber(item.amount);
            }
          }

          for (const item of related) {
            item.settled = true;
            item.settledAt = new Date().toISOString();
          }

          settledMatchIds.push(bet.matchId);
        }

        saveUserBets(userEmail, bets);
      }

      return new Response(JSON.stringify({ success: true, settledMatchIds, balanceUpdates, users: Object.fromEntries(STORE.users) }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Acción no soportada' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Error del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
