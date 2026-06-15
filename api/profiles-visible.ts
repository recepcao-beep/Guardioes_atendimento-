import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    const url = process.env.VITE_SUPABASE_URL || "";
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !anonKey || !serviceKey) {
      return res.status(500).json({ error: "Credenciais do Supabase nao configuradas." });
    }

    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!accessToken) {
      return res.status(401).json({ error: "Sessao ausente." });
    }

    const supabaseAuth = createClient(url, anonKey);
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return res.status(401).json({ error: "Sessao invalida ou expirada." });
    }

    const supabaseAdmin = createClient(url, serviceKey);
    const { data: actorProfile, error: actorError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (actorError || !actorProfile) {
      return res.status(403).json({ error: "Usuario nao autorizado." });
    }

    let query = supabaseAdmin
      .from("profiles")
      .select("id, full_name, username, role, sector_id, active, must_change_password, last_login_at, avatar_url, created_at, updated_at");

    if (actorProfile.role !== "admin") {
      query = query.eq("active", true);
    }

    const { data, error } = await query.order("full_name");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ profiles: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
