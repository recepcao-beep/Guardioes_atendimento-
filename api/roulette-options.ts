import { createClient } from "@supabase/supabase-js";

const defaultOptions = [
  { id: "late-check-out", label: "Late check out", active: true },
  { id: "espumante", label: "Espumante", active: true },
  { id: "mesa-found", label: "Mesa de found", active: true },
  { id: "cafe-1kg", label: "1kg de café", active: true },
  { id: "nada", label: "Nada", active: true }
];

const normalizeOptions = (options: any[]) =>
  options
    .map((option, index) => ({
      id: String(option.id || `opt-${Date.now()}-${index}`).trim(),
      label: String(option.label || "").trim(),
      active: option.active !== false
    }))
    .filter(option => option.label.length > 0);

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (!["GET", "POST"].includes(req.method)) {
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

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "roulette_options")
        .maybeSingle();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const options = Array.isArray(data?.value?.options) ? data.value.options : defaultOptions;
      return res.status(200).json({ options });
    }

    const { data: actorProfile, error: actorError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (actorError || !actorProfile || actorProfile.role !== "admin") {
      return res.status(403).json({ error: "Apenas administradores podem alterar a roleta." });
    }

    const options = normalizeOptions(Array.isArray(req.body?.options) ? req.body.options : []);
    if (options.length < 2) {
      return res.status(400).json({ error: "Cadastre pelo menos duas opcoes ativas para a roleta." });
    }

    const { error: upsertError } = await supabaseAdmin
      .from("app_settings")
      .upsert({
        key: "roulette_options",
        value: { options },
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

    if (upsertError) {
      return res.status(400).json({ error: upsertError.message });
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: authData.user.id,
      action: "alteracao de opcoes da roleta",
      entity_type: "app_settings",
      entity_id: "roulette_options",
      metadata: { options_count: options.length }
    });

    return res.status(200).json({ success: true, options });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
