import { createClient } from "@supabase/supabase-js";

const normalizeUsername = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    .trim()
    .replace(/[^a-z0-9._-]/g, "");

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
    const url = process.env.VITE_SUPABASE_URL || "";
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !serviceKey) {
      return res.status(500).json({ error: "Credenciais do Supabase nao configuradas no servidor." });
    }

    const {
      full_name,
      password_initial,
      sector_id,
      active = true,
      must_change_password = true,
      actor_id,
      avatar_url
    } = req.body || {};
    const username = normalizeUsername(req.body?.username);

    if (!full_name || !username || !password_initial) {
      return res.status(400).json({ error: "Nome, usuario e senha inicial sao obrigatorios." });
    }

    const supabaseAdmin = createClient(url, serviceKey);
    let actorId = actor_id || "";

    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (accessToken && anonKey) {
      const supabaseAuth = createClient(url, anonKey);
      const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !authData.user) {
        return res.status(401).json({ error: "Sessao invalida ou expirada." });
      }
      actorId = authData.user.id;
    }

    if (!actorId) {
      return res.status(401).json({ error: "Administrador nao identificado." });
    }

    const { data: actorProfile, error: actorError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", actorId)
      .maybeSingle();

    if (actorError || !actorProfile || actorProfile.role !== "admin") {
      return res.status(403).json({ error: "Apenas administradores podem criar colaboradores." });
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingProfile) {
      return res.status(400).json({ error: "Nome de usuario ja esta em uso." });
    }

    const email = `${username}@hotelreviews.com`;
    let createdNewAuthUser = true;
    let { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password_initial,
      email_confirm: true,
      user_metadata: {
        role: "guardian",
        full_name,
        username,
        must_change_password
      }
    });

    if (authError || !authUser.user) {
      const authMessage = authError?.message || "";
      const canRecoverExistingAuth = authMessage.toLowerCase().includes("already") || authMessage.toLowerCase().includes("registered");
      if (!canRecoverExistingAuth) {
        return res.status(400).json({ error: `Erro ao registrar credenciais: ${authMessage || "usuario nulo"}` });
      }

      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) {
        return res.status(400).json({ error: `Usuario ja existe no Auth, mas nao foi possivel recuperar: ${listError.message}` });
      }

      const existingAuthUser = usersData.users.find(user => user.email?.toLowerCase() === email.toLowerCase());
      if (!existingAuthUser) {
        return res.status(400).json({ error: "Usuario ja existe no Auth, mas nao foi localizado para sincronizar o perfil." });
      }

      createdNewAuthUser = false;
      const { data: updatedAuth, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
        password: password_initial,
        email_confirm: true,
        user_metadata: {
          role: "guardian",
          full_name,
          username,
          must_change_password
        }
      });

      if (updateAuthError || !updatedAuth.user) {
        return res.status(400).json({ error: `Erro ao atualizar credenciais existentes: ${updateAuthError?.message || "usuario nulo"}` });
      }

      authUser = updatedAuth;
    }

    const insertPayload: Record<string, any> = {
      id: authUser.user.id,
      full_name,
      username,
      role: "guardian",
      sector_id: sector_id || null,
      active,
      must_change_password
    };
    if (avatar_url !== undefined) {
      insertPayload.avatar_url = avatar_url;
    }

    let { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (profileError && profileError.message.includes("avatar_url")) {
      delete insertPayload.avatar_url;
      const retry = await supabaseAdmin
        .from("profiles")
        .insert(insertPayload)
        .select()
        .maybeSingle();
      profile = retry.data;
      profileError = retry.error;
    }

    if (profileError || !profile) {
      if (createdNewAuthUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      }
      return res.status(400).json({ error: `Erro ao criar perfil: ${profileError?.message || "perfil nulo"}` });
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: actorId,
      action: "criacao de colaborador",
      entity_type: "profiles",
      entity_id: profile.id,
      metadata: { full_name, username }
    });

    return res.status(200).json({ user: profile });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
