import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    const { invite_id, guest_name, room_number } = req.body || {};
    if (!invite_id || !guest_name || !room_number) {
      return res.status(400).json({ error: "Dados obrigatorios ausentes." });
    }

    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!accessToken) {
      return res.status(401).json({ error: "Sessao ausente." });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return res.status(500).json({ error: "Credenciais do Supabase nao configuradas no servidor." });
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return res.status(401).json({ error: "Sessao invalida ou expirada." });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const actorId = authData.user.id;

    const { data: actorProfile, error: actorError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", actorId)
      .maybeSingle();

    if (actorError || !actorProfile) {
      return res.status(403).json({ error: "Usuario nao autorizado." });
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("review_invites")
      .select("*")
      .eq("id", invite_id)
      .maybeSingle();

    if (inviteError || !invite) {
      return res.status(404).json({ error: "Convite nao encontrado." });
    }

    const canUpdate = actorProfile.role === "admin" || invite.issuer_user_id === actorId;
    if (!canUpdate) {
      return res.status(403).json({ error: "Sem permissao para atualizar este convite." });
    }

    const nextGuestName = String(guest_name).trim();
    const nextRoomNumber = String(room_number).trim();
    const now = new Date().toISOString();

    const { data: updatedInvite, error: updateError } = await supabaseAdmin
      .from("review_invites")
      .update({
        guest_name: nextGuestName,
        room_number: nextRoomNumber,
        updated_at: now
      })
      .eq("id", invite_id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: `Falha ao atualizar convite: ${updateError.message}` });
    }

    await supabaseAdmin
      .from("complaints")
      .update({
        guest_name: nextGuestName,
        room_number: nextRoomNumber,
        updated_at: now
      })
      .eq("invite_id", invite_id);

    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: actorId,
      action: "edicao de dados do hospede do convite",
      entity_type: "review_invites",
      entity_id: invite_id,
      metadata: {
        guest_name: nextGuestName,
        room_number: nextRoomNumber,
        previous_guest_name: invite.guest_name,
        previous_room_number: invite.room_number
      }
    });

    return res.status(200).json({ invite: updatedInvite });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
