import { createClient } from "@supabase/supabase-js";

const DEFAULT_WORKFLOW_ID = "myhotel-reconciliation-robot.yml";

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
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!accessToken) {
      return res.status(401).json({ error: "Sessao ausente." });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return res.status(500).json({ error: "Credenciais do Supabase nao configuradas." });
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return res.status(401).json({ error: "Sessao invalida ou expirada." });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: actorProfile, error: actorError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (actorError || !actorProfile || actorProfile.role !== "admin") {
      return res.status(403).json({ error: "Apenas administradores podem disparar o robo." });
    }

    const githubToken = process.env.GITHUB_ACTIONS_TOKEN || "";
    const owner = process.env.GITHUB_ACTIONS_OWNER || "recepcao-beep";
    const repo = process.env.GITHUB_ACTIONS_REPO || "Guardioes_atendimento-";
    const workflowId = process.env.GITHUB_ACTIONS_WORKFLOW_ID || DEFAULT_WORKFLOW_ID;
    const ref = process.env.GITHUB_ACTIONS_REF || "main";

    if (!githubToken) {
      return res.status(500).json({ error: "GITHUB_ACTIONS_TOKEN nao configurado no Vercel." });
    }

    const confirm = req.body?.confirm === false ? "false" : "true";
    const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
    const response = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        ref,
        inputs: { confirm }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      return res.status(response.status).json({
        error: "Falha ao disparar GitHub Actions.",
        details
      });
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: authData.user.id,
      action: "disparo robo myhotel github actions",
      entity_type: "automation",
      entity_id: null,
      metadata: { owner, repo, workflow_id: workflowId, ref, confirm }
    });

    return res.status(200).json({ success: true, owner, repo, workflow_id: workflowId, ref, confirm });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
