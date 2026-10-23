function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function onRequestPost(context) {
  const env = context.env;
  try {
    const body = await context.request.json().catch(() => ({}));
    const fromEmail = normalizeEmail(body.fromEmail);
    const toEmail = normalizeEmail(body.toEmail);
    const amount = asNumber(body.amount);

    if (!fromEmail || !toEmail || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Parámetros inválidos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (fromEmail === toEmail) {
      return new Response(JSON.stringify({ error: 'No puedes transferirte saldo a ti mismo' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fromUser = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(fromEmail).first();

    const toUser = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(toEmail).first();

    if (!fromUser) {
      return new Response(JSON.stringify({ error: 'Usuario origen no existe' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!toUser) {
      return new Response(JSON.stringify({ error: 'Usuario destino no existe' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if ((fromUser.balance || 0) < amount) {
      return new Response(JSON.stringify({ error: 'Saldo insuficiente' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await env.DB.prepare('BEGIN IMMEDIATE').run();

    try {
      await env.DB.prepare(
        'UPDATE users SET balance = balance - ? WHERE email = ?'
      ).bind(amount, fromEmail).run();

      await env.DB.prepare(
        'UPDATE users SET balance = balance + ? WHERE email = ?'
      ).bind(amount, toEmail).run();

      await env.DB.prepare(
        'INSERT INTO transfers (from_email, to_email, amount) VALUES (?, ?, ?)'
      ).bind(fromEmail, toEmail, amount).run();

      await env.DB.prepare('COMMIT').run();

      const updatedFrom = await env.DB.prepare(
        'SELECT * FROM users WHERE email = ?'
      ).bind(fromEmail).first();

      const updatedTo = await env.DB.prepare(
        'SELECT * FROM users WHERE email = ?'
      ).bind(toEmail).first();

      return new Response(JSON.stringify({
        success: true,
        message: `Se transfirieron ${amount} vCUP exitosamente`,
        from: updatedFrom,
        to: updatedTo
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      await env.DB.prepare('ROLLBACK').run();
      throw err;
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error en la transferencia' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
