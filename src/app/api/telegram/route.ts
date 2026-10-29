import { splitsForRoster } from "@/lib/botSplits";
import { adminSupabase, missingBotEnv, sendMessage, webhookSecret } from "@/lib/server/telegram";
import type { Player } from "@/lib/types";

interface Update {
  message?: { chat: { id: number; type: string }; text?: string };
}

const HELP = [
  "שלום! אני הבוט של כוחות ⚽",
  "",
  "1. באפליקציה: הגדרות ← בוט טלגרם ← קבלת קוד.",
  "2. כאן: /link ואחריו הקוד.",
  "3. מדביקים את רשימת המגיעים (כמו מהוואטסאפ) ומקבלים 3 חלוקות מאוזנות.",
  "",
  "/unlink מנתק.",
].join("\n");

/** Telegram calls this for every message the bot gets. */
export async function POST(request: Request) {
  if (missingBotEnv.length) return new Response(`Missing env: ${missingBotEnv.join(", ")}`, { status: 500 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return new Response("Forbidden", { status: 403 });
  }
  const update = (await request.json()) as Update;
  const message = update.message;
  // Private chats only, so a roster never lands in a shared group chat.
  if (message?.text && message.chat.type === "private") {
    try {
      await handle(message.chat.id, message.text.trim());
    } catch (e) {
      console.error(e);
      await sendMessage(message.chat.id, "משהו השתבש, נסו שוב בעוד רגע.");
    }
  }
  // Always 200, or Telegram keeps resending the same update.
  return new Response("ok");
}

async function handle(chatId: number, text: string) {
  const db = adminSupabase();
  const [command, arg] = text.split(/\s+/, 2);

  if (command === "/start" || command === "/link") {
    if (!arg) return sendMessage(chatId, HELP);
    const { data: code } = await db
      .from("telegram_link_codes")
      .delete()
      .eq("code", arg.toUpperCase())
      .gt("expires_at", new Date().toISOString())
      .select("user_id, group_id")
      .maybeSingle();
    if (!code) return sendMessage(chatId, "הקוד לא נמצא או שפג תוקפו. צרו קוד חדש בהגדרות של האפליקציה.");
    const { error } = await db.from("telegram_links").upsert({ chat_id: chatId, user_id: code.user_id, group_id: code.group_id, linked_at: new Date().toISOString() });
    if (error) throw error;
    const { data: group } = await db.from("groups").select("name").eq("id", code.group_id).single();
    return sendMessage(chatId, `מחובר לחבורה "${group?.name ?? ""}" ✓\nעכשיו הדביקו את רשימת המגיעים.`);
  }

  if (command === "/unlink") {
    await db.from("telegram_links").delete().eq("chat_id", chatId);
    return sendMessage(chatId, "נותקת. אפשר להתחבר שוב עם קוד חדש.");
  }

  if (command.startsWith("/")) return sendMessage(chatId, HELP);

  const { data: link } = await db.from("telegram_links").select("user_id, group_id").eq("chat_id", chatId).maybeSingle();
  if (!link) return sendMessage(chatId, HELP);
  if (!(await isManager(link.user_id, link.group_id))) {
    await db.from("telegram_links").delete().eq("chat_id", chatId);
    return sendMessage(chatId, "את/ה כבר לא מנהל/ת בחבורה הזו, אז החיבור בוטל.");
  }

  const { data: players, error } = await db.from("players").select("*").eq("group_id", link.group_id);
  if (error) throw error;
  const result = splitsForRoster(text, (players ?? []).map((p) => ({ ...p, rating: Number(p.rating) }) as Player));
  if (result.playerCount < 3) return sendMessage(chatId, "לא מצאתי מספיק שמות ברשימה. הדביקו שם אחד בכל שורה.");

  const intro = [`${result.playerCount} שחקנים, ${result.splits.length} חלוקות:`];
  if (result.unknown.length) intro.push(`לא מוכרים (חושבו ברמה 4): ${result.unknown.join(", ")}`);
  await sendMessage(chatId, intro.join("\n"));
  // One message per split, so each one can be copied or forwarded on its own.
  for (const split of result.splits) await sendMessage(chatId, split);
}

async function isManager(userId: string, groupId: string): Promise<boolean> {
  const db = adminSupabase();
  const [admin, member] = await Promise.all([
    db.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    db.from("group_members").select("role").eq("group_id", groupId).eq("user_id", userId).maybeSingle(),
  ]);
  return Boolean(admin.data) || member.data?.role === "manager";
}
