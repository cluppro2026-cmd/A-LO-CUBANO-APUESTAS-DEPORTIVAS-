function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function asNumber(value, defaultValue = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

function isLockedByTime(matchDate) {
  if (!matchDate) return true;
  const matchTime = new Date(matchDate).getTime();
  if (!Number.isFinite(matchTime)) return true;
  return (matchTime - Date.now()) <= (60 * 60 * 1000);
}

async function getUserByEmail(env, email) {
  return await env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first();
}

async function ensureUser(env, email) {
  const normalized = normalizeEmail(email);
  let user = await getUserByEmail(env, normalized);

  if (!user) {
    await env.DB.prepare(
      'INSERT INTO users (email, balance) VALUES (?, 0)'
    ).bind(normalized).run();

    user = await getUserByEmail(env, normalized);
  }

  return user;
}

async function getUserBets(env, email) {
  const rows = await env.DB.prepare(
    'SELECT * FROM bets WHERE user_email = ? ORDER BY created_at DESC'
  ).bind(email).all();

  return rows.results || [];
}

export async function onRequestGet(context) {
  const env = context.env;
  const url = new URL(context.request.url);
  const email = normalizeEmail(url.searchParams.get('email'));

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const user = await ensureUser(env, email);
  const bets = await getUserBets(env, email);

  return new Response(JSON.stringify({ success: true, user, bets }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const env = context.env;
  try {
    const body = await context.request.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase();
    const email = normalizeEmail(body.email || body.userEmail);

    if (action === 'register' || action === 'init-user') {
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email requerido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const user = await ensureUser(env, email);

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

      const amount = asNumber(body.amount);
      const matchId = String(body.matchId || '').trim();
      const choice = String(body.choice || '').trim().toUpperCase();
      const matchDate = body.matchDate || body.date;
      const sport = String(body.sport || 'FOOTBALL').toUpperCase();

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

      const user = await ensureUser(env, email);

      if ((user.balance || 0) < amount) {
        return new Response(JSON.stringify({ error: 'Saldo insuficiente' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const betId = `bet_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      await env.DB.prepare(
        'UPDATE users SET balance = balance - ? WHERE email = ?'
      ).bind(amount, email).run();

      await env.DB.prepare(`
        INSERT INTO bets (id, user_email, match_id, choice, amount, sport, match_date, settled, payout)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
      `).bind(
        betId,
        email,
        matchId,
        choice,
        amount,
        sport,
        matchDate || null
      ).run();

      const updatedUser = await getUserByEmail(env, email);

      return new Response(JSON.stringify({
        success: true,
        user: updatedUser,
        bet: {
          id: betId,
          user_email: email,
          match_id: matchId,
          choice,
          amount,
          sport,
          match_date: matchDate
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Acción no soportada' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
