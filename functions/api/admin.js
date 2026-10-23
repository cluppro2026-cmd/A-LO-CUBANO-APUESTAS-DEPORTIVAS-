function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function getUserByEmail(env, email) {
  return await env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first();
}

export async function onRequestPost(context) {
  const env = context.env;
  try {
    const body = await context.request.json().catch(() => ({}));
    const masterKey = String(body.masterKey || '');
    const amount = Number(body.amount || 0);
    const email = normalizeEmail(body.email);

    if (masterKey !== 'MASTER123') {
      return new Response(JSON.stringify({ error: 'Llave maestra incorrecta' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!email || !Number.isFinite(amount)) {
      return new Response(JSON.stringify({ error: 'Usuario y monto requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let user = await getUserByEmail(env, email);

    if (!user) {
      await env.DB.prepare(
        'INSERT INTO users (email, balance) VALUES (?, 0)'
      ).bind(email).run();
      user = await getUserByEmail(env, email);
    }

    const delta = Number(amount);

    await env.DB.prepare(
      'UPDATE users SET balance = balance + ? WHERE email = ?'
    ).bind(delta, email).run();

    await env.DB.prepare(
      'INSERT INTO transfers (from_email, to_email, amount) VALUES (?, ?, ?)'
    ).bind('admin', email, delta).run();

    const updatedUser = await getUserByEmail(env, email);

    return new Response(JSON.stringify({
      success: true,
      message: `Se acreditaron ${delta} vCUP a ${email}`,
      user: updatedUser
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error del administrador' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
