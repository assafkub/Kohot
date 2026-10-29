import { missingBotEnv, telegram, webhookSecret } from "@/lib/server/telegram";

/**
 * Open once in the browser: /api/telegram/setup?secret=<TELEGRAM_WEBHOOK_SECRET>
 * Points the bot at this site, so the token never has to be typed anywhere.
 */
export async function GET(request: Request) {
  if (missingBotEnv.length) return new Response(`Missing env: ${missingBotEnv.join(", ")}`, { status: 500 });
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== webhookSecret) return new Response("Forbidden", { status: 403 });
  const webhook = `${url.origin}/api/telegram`;
  const set = await telegram("setWebhook", { url: webhook, secret_token: webhookSecret, allowed_updates: ["message"] });
  const me = await telegram("getMe", {});
  const bot = (me.result as { username?: string } | undefined)?.username;
  return Response.json({ ok: set.ok, webhook, bot: bot ? `@${bot}` : null, error: set.description });
}
