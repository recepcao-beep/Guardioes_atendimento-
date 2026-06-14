import { createClient } from "@supabase/supabase-js";

const fallbackToSpa = (res: any, token: string) => {
  return res.redirect(302, `/r/${encodeURIComponent(token || "")}`);
};

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  const token = String(req.query?.token || "");

  try {
    if (!token) {
      return res.redirect(302, "/");
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !serviceKey) {
      return fallbackToSpa(res, token);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("review_invites")
      .select("*, platforms(code, external_url)")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite || invite.status === "cancelled") {
      return fallbackToSpa(res, token);
    }

    const platform = invite.platforms;
    if (!platform) {
      return fallbackToSpa(res, token);
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("review_invites")
      .update({
        opened_count: (invite.opened_count || 0) + 1,
        status: invite.status === "emitted" ? "opened" : invite.status,
        first_opened_at: invite.first_opened_at || now,
        last_opened_at: now
      })
      .eq("id", invite.id);

    if (updateError) {
      return fallbackToSpa(res, token);
    }

    await supabaseAdmin.from("review_events").insert({
      invite_id: invite.id,
      event_type: "redirect_opened",
      metadata: { date: now, platform_code: platform.code, source: "vercel_redirect" }
    });

    let redirectUrl = platform.external_url;
    if (platform.code === "internal" && (!redirectUrl || redirectUrl.trim() === "" || redirectUrl.includes("avaliacao-interna"))) {
      redirectUrl = `/avaliacao-interna/${encodeURIComponent(token)}`;
    }

    if (!redirectUrl || redirectUrl.trim() === "") {
      return fallbackToSpa(res, token);
    }

    return res.redirect(302, redirectUrl);
  } catch {
    return fallbackToSpa(res, token);
  }
}
