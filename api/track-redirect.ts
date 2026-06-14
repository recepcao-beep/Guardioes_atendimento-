import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const { token } = req.body || {};
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token de convite ausente." });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: "Credenciais seguras do Supabase não configuradas no servidor." });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("review_invites")
      .select("*, platforms(code, external_url)")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      return res.status(404).json({ error: inviteError?.message || "Token de convite inválido ou inexistente." });
    }

    if (invite.status === "cancelled") {
      return res.status(400).json({ error: "Este convite foi cancelado." });
    }

    const platform = invite.platforms;
    if (!platform) {
      return res.status(404).json({ error: "Plataforma correspondente não encontrada." });
    }

    const now = new Date().toISOString();
    const { data: updatedInvite, error: updateError } = await supabaseAdmin
      .from("review_invites")
      .update({
        opened_count: (invite.opened_count || 0) + 1,
        status: invite.status === "emitted" ? "opened" : invite.status,
        first_opened_at: invite.first_opened_at || now,
        last_opened_at: now
      })
      .eq("id", invite.id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: `Falha ao registrar abertura: ${updateError.message}` });
    }

    await supabaseAdmin.from("review_events").insert({
      invite_id: invite.id,
      event_type: "redirect_opened",
      metadata: { date: now, platform_code: platform.code, source: "vercel_api" }
    });

    let redirectUrl = platform.external_url;
    if (platform.code === "internal" && (!redirectUrl || redirectUrl.trim() === "" || redirectUrl.includes("avaliacao-interna"))) {
      redirectUrl = `/avaliacao-interna/${token}`;
    }

    if (!redirectUrl || redirectUrl.trim() === "") {
      return res.status(400).json({ error: "Nenhuma URL final configurada para esta plataforma." });
    }

    return res.status(200).json({ url: redirectUrl, invite: updatedInvite });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
