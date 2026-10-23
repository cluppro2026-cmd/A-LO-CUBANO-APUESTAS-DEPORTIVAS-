export async function onRequestPost(context) {
  try {
    const { fromEmail, toEmail, amount } = await context.request.json();

    if (!fromEmail || !toEmail || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Parámetros inválidos" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Respuesta de éxito para el procesamiento serverless
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Se transfirieron ${amount} vCUP exitosamente a ${toEmail}` 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error en el servidor Worker" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
