// Cliente mínimo para Slack Web API. Solo lo justo para chat.postMessage al
// canal del staff y DMs al creador (cuando profiles.slack_user_id está mapeado).
//
// Diseñado a prueba de fallos: si Slack está caído o la config no existe,
// loggeamos y devolvemos en silencio. Nunca debe romper la acción del usuario.

type SlackBlock = Record<string, unknown>;

type PostMessageArgs = {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
};

async function postMessage(args: PostMessageArgs): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn("[slack] SLACK_BOT_TOKEN no configurado, omito mensaje");
    return;
  }

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(args),
    });
    const body = (await res.json()) as { ok: boolean; error?: string };
    if (!body.ok) {
      console.error("[slack] chat.postMessage falló:", body.error, args.channel);
    }
  } catch (err) {
    console.error("[slack] error de red:", err);
  }
}

export function sendChannelMessage(text: string, blocks?: SlackBlock[]) {
  const channel = process.env.SLACK_RESERVAS_CHANNEL_ID;
  if (!channel) {
    console.warn("[slack] SLACK_RESERVAS_CHANNEL_ID no configurado");
    return Promise.resolve();
  }
  return postMessage({ channel, text, blocks });
}

// Slack acepta el user_id directo como `channel` en chat.postMessage y abre
// el DM automáticamente si el bot tiene scope im:write.
export function sendDirectMessage(
  slackUserId: string,
  text: string,
  blocks?: SlackBlock[]
) {
  return postMessage({ channel: slackUserId, text, blocks });
}
