export async function onRequestPost(context) {
  const FOOTBALL_API_KEY = "26649c1bb8fa4c11ba8a5c6ea393df58";

  try {
    const { userBets } = await context.request.json();
    if (!userBets || userBets.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No hay apuestas activas" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const res = await fetch("https://api.football-data.org/v4/competitions/PD/matches?status=FINISHED", {
      headers: { "X-Auth-Token": FOOTBALL_API_KEY }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ success: false, message: "Error consultando resultados" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await res.json();
    const finishedMatches = data.matches || [];
    let balanceUpdates = {};
    let settledMatchIds = [];

    for (const match of finishedMatches) {
      const matchId = `fb_${match.id}`;
      const winner = match.score.winner; // "HOME_TEAM", "AWAY_TEAM", "DRAW"
      let winningOption = winner === "HOME_TEAM" ? "HOME" : (winner === "AWAY_TEAM" ? "AWAY" : "DRAW");

      const matchBets = userBets.filter(b => b.matchId === matchId && !b.settled);
      if (matchBets.length === 0) continue;

      const totalPool = matchBets.reduce((sum, b) => sum + b.amount, 0);
      const winningBets = matchBets.filter(b => b.choice === winningOption);
      const totalWinningAmount = winningBets.reduce((sum, b) => sum + b.amount, 0);

      if (totalWinningAmount > 0) {
        const distributablePool = totalPool * 0.90; // 90% para los ganadores (10% comisión de la casa)

        winningBets.forEach(bet => {
          const share = bet.amount / totalWinningAmount;
          const payout = share * distributablePool;
          balanceUpdates[bet.userEmail] = (balanceUpdates[bet.userEmail] || 0) + payout;
        });
      } else {
        // Reembolso 100% si nadie acertó
        matchBets.forEach(bet => {
          balanceUpdates[bet.userEmail] = (balanceUpdates[bet.userEmail] || 0) + bet.amount;
        });
      }

      settledMatchIds.push(matchId);
    }

    return new Response(JSON.stringify({
      success: true,
      settledMatchIds,
      balanceUpdates
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
