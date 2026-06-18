import { createClient } from "@supabase/supabase-js";

const allowedStatuses = new Set(["pending", "contacted", "not_contacted"]);

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const url = process.env.VITE_SUPABASE_URL || "";
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !anonKey || !serviceKey) return res.status(500).json({ error: "Credenciais do Supabase nao configuradas." });

    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!accessToken) return res.status(401).json({ error: "Sessao ausente." });

    const supabaseAuth = createClient(url, anonKey);
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !authData.user) return res.status(401).json({ error: "Sessao invalida ou expirada." });

    const supabaseAdmin = createClient(url, serviceKey);
    const { data: actorProfile, error: actorError } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (actorError || !actorProfile || actorProfile.active === false) {
      return res.status(403).json({ error: "Perfil sem permissao para registrar contato Booking." });
    }

    const { lead_id, contact_status, contact_notes, review_converted, complaint_generated } = req.body || {};
    if (!lead_id) return res.status(400).json({ error: "Lead ausente." });
    if (!allowedStatuses.has(contact_status)) return res.status(400).json({ error: "Status de contato invalido." });

    const now = new Date().toISOString();
    const { data: lead, error } = await supabaseAdmin
      .from("booking_leads")
      .update({
        contact_status,
        contact_notes: contact_notes || null,
        review_converted: !!review_converted,
        complaint_generated: !!complaint_generated,
        contacted_by: authData.user.id,
        contacted_at: contact_status === "pending" ? null : now,
        updated_at: now
      })
      .eq("id", lead_id)
      .select()
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });

    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: authData.user.id,
      action: "registro de contato booking",
      entity_type: "booking_leads",
      entity_id: lead_id,
      metadata: { contact_status, review_converted: !!review_converted, complaint_generated: !!complaint_generated }
    });

    return res.status(200).json({ lead });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
