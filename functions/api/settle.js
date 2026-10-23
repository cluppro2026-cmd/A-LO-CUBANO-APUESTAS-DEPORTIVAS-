function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapWinnerToChoice(winner) {
  if (winner === 'HOME_TEAM') return 'HOME';
  if (winner === 'AWAY_TEAM') return 'AWAY';
  return 'DRAW';
}

export async function onRequestPost(context) {
  const env = context.env;
  try {
    const body = await context.request.json().catch(() => ({}));
    const targetEmail = body && body.targetEmail ? normalizeEmail(body.targetEmail) : null;
    const userBets = Array.isArray(body.userBets) ? body.userBets : null;

    let betsToSettle = [];

    if (userBets && userBets.length > 0) {
      betsToSettle = userBets;
    } else {
      const where = targetEmail
        ? 'WHERE user_email = ? AND settled = 0'
        : 'WHERE settled = 0';

      const params = targetEmail ? [targetEmail] : [];
      const res = await env.DB.prepare(
        `SELECT * FROM bets ${where} ORDER BY created_at DESC`
      ).bind(...params).all();

      betsToSettle = res.results || [];
    }

    if (!betsToSettle.length) {
      return new Response(JSON.stringify({
        success: true,
        settledMatchIds: [],
        balanceUpdates: {}
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const footballRes = await fetch('https://api.football-data.org/v4/competitions/PD/matches?status=FINISHED&limit=50', {
      headers: { 'X-Auth-Token': '26649c1bb8fa4c11ba8a5c6ea393df58' }
    });

    if (!footballRes.ok) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Error consultando resultados',
        code: footballRes.status
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const footballData = await footballRes.json();
    const finalResults = new Map();

    for (const match of footballData.matches || []) {
      const matchId = `fb_${match.id}`;
      const winner = match?.score?.winner || 'DRAW';
      const choice = mapWinnerToChoice(winner);
      finalResults.set(matchId, choice);
    }

    const balanceUpdates = {};
    const settledMatchIds = [];
    const groupedByMatch = new Map();

    for (const bet of betsToSettle) {
      if (!bet || bet.settled === 1) continue;
      const matchId = String(bet.match_id || '');
      if (!matchId) continue;

      if (!groupedByMatch.has(matchId)) {
        groupedByMatch.set(matchId, []);
      }

      groupedByMatch.get(matchId).push(bet);
    }

    for (const [matchId, betsForMatch] of groupedByMatch.entries()) {
      const result = finalResults.get(matchId);
      if (!result) continue;

      const totalPool = betsForMatch.reduce((sum, bet) => sum + asNumber(bet.amount), 0);
      const winners = betsForMatch.filter((bet) => String(bet.choice || '').toUpperCase() === result.toUpperCase());
      const totalWinningAmount = winners.reduce((sum, bet) => sum + asNumber(bet.amount), 0);

      if (totalWinningAmount > 0) {
        const distributablePool = totalPool * 0.90;

        for (const winner of winners) {
          const ratio = asNumber(winner.amount) / totalWinningAmount;
          const payout = ratio * distributablePool;
          const userEmail = normalizeEmail(winner.user_email);

          balanceUpdates[userEmail] = (balanceUpdates[userEmail] || 0) + payout;

          await env.DB.prepare(
            'UPDATE users SET balance = balance + ? WHERE email = ?'
          ).bind(payout, userEmail).run();

          await env.DB.prepare(
            'UPDATE bets SET settled = 1, payout = ? WHERE id = ?'
          ).bind(payout, winner.id).run();

          settledMatchIds.push(matchId);
        }
      } else {
        for (const bet of betsForMatch) {
          const userEmail = normalizeEmail(bet.user_email);
          const refund = asNumber(bet.amount);

          balanceUpdates[userEmail] = (balanceUpdates[userEmail] || 0) + refund;

          await env.DB.prepare(
            'UPDATE users SET balance = balance + ? WHERE email = ?'
          ).bind(refund, userEmail).run();

          await env.DB.prepare(
            'UPDATE bets SET settled = 1, payout = ? WHERE id = ?'
          ).bind(refund, bet.id).run();

          settledMatchIds.push(matchId);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      settledMatchIds: [...new Set(settledMatchIds)],
      balanceUpdates
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error en la liquidación' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
