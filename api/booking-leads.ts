import { createClient } from "@supabase/supabase-js";

async function requireAuthenticatedProfile(req: any) {
  const url = process.env.VITE_SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !anonKey || !serviceKey) {
    return { error: "Credenciais do Supabase nao configuradas.", status: 500 };
  }

  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!accessToken) return { error: "Sessao ausente.", status: 401 };

  const supabaseAuth = createClient(url, anonKey);
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
  if (authError || !authData.user) return { error: "Sessao invalida ou expirada.", status: 401 };

  const supabaseAdmin = createClient(url, serviceKey);
  const { data: actorProfile, error: actorError } = await supabaseAdmin
    .from("profiles")
    .select("role, active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (actorError || !actorProfile || actorProfile.active === false) {
    return { error: "Perfil sem permissao para acessar a listagem Booking.", status: 403 };
  }

  return { userId: authData.user.id, supabaseAdmin };
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const auth = await requireAuthenticatedProfile(req);
    if ((auth as any).error) return res.status((auth as any).status).json({ error: (auth as any).error });

    const { data, error } = await (auth as any).supabaseAdmin
      .from("booking_leads")
      .select("*")
      .order("stay_end", { ascending: false })
      .order("guest_name");

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ leads: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
