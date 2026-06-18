import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Browser-facing redirect route for QR Codes and WhatsApp links.
  app.get("/api/r/:token", async (req, res) => {
    try {
      const { token } = req.params;
      if (!token || typeof token !== "string") {
        return res.redirect(302, "/");
      }

      const url = process.env.VITE_SUPABASE_URL || "";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      if (!url || !serviceKey) {
        return res.redirect(302, `/r/${encodeURIComponent(token)}`);
      }

      const supabaseAdmin = createClient(url, serviceKey);

      const { data: invite, error: inviteError } = await supabaseAdmin
        .from("review_invites")
        .select("*, platforms(code, external_url)")
        .eq("token", token)
        .maybeSingle();

      if (inviteError || !invite || invite.status === "cancelled") {
        return res.redirect(302, `/r/${encodeURIComponent(token)}`);
      }

      const platform = invite.platforms;
      if (!platform) {
        return res.redirect(302, `/r/${encodeURIComponent(token)}`);
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
        return res.redirect(302, `/r/${encodeURIComponent(token)}`);
      }

      await supabaseAdmin.from("review_events").insert({
        invite_id: invite.id,
        event_type: "redirect_opened",
        metadata: { date: now, platform_code: platform.code, source: "server_redirect" }
      });

      let redirectUrl = platform.external_url;
      if (platform.code === "internal" && (!redirectUrl || redirectUrl.trim() === "" || redirectUrl.includes("avaliacao-interna"))) {
        redirectUrl = `/avaliacao-interna/${encodeURIComponent(token)}`;
      }

      if (!redirectUrl || redirectUrl.trim() === "") {
        return res.redirect(302, `/r/${encodeURIComponent(token)}`);
      }

      return res.redirect(302, redirectUrl);
    } catch {
      return res.redirect(302, `/r/${encodeURIComponent(req.params.token || "")}`);
    }
  });

  // Public API Route to track QR/WhatsApp opens and return the final review URL.
  app.post("/api/track-redirect", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Token de convite ausente." });
      }

      const url = process.env.VITE_SUPABASE_URL || "";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      if (!url || !serviceKey) {
        return res.status(500).json({ error: "Supabase service credentials not configured on server" });
      }

      const supabaseAdmin = createClient(url, serviceKey);

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
        metadata: { date: now, platform_code: platform.code, source: "server_api" }
      });

      let redirectUrl = platform.external_url;
      if (platform.code === "internal" && (!redirectUrl || redirectUrl.trim() === "" || redirectUrl.includes("avaliacao-interna"))) {
        redirectUrl = `/avaliacao-interna/${token}`;
      }

      if (!redirectUrl || redirectUrl.trim() === "") {
        return res.status(400).json({ error: "Nenhuma URL final configurada para esta plataforma." });
      }

      return res.json({ url: redirectUrl, invite: updatedInvite });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // API Route to update invite guest data for reconciliation.
  app.post("/api/update-invite-guest", async (req, res) => {
    try {
      const { invite_id, guest_name, room_number } = req.body;
      if (!invite_id || !guest_name || !room_number) {
        return res.status(400).json({ error: "Dados obrigatorios ausentes." });
      }

      const authHeader = req.headers.authorization || "";
      const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
      if (!accessToken) {
        return res.status(401).json({ error: "Sessao ausente." });
      }

      const url = process.env.VITE_SUPABASE_URL || "";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
      if (!url || !serviceKey || !anonKey) {
        return res.status(500).json({ error: "Supabase credentials not configured on server" });
      }

      const supabaseAuth = createClient(url, anonKey);
      const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !authData.user) {
        return res.status(401).json({ error: "Sessao invalida ou expirada." });
      }

      const supabaseAdmin = createClient(url, serviceKey);
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

      return res.json({ invite: updatedInvite });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // API Route to Create Guardian safely from server side using admin privileges
  app.post("/api/create-guardian", async (req, res) => {
    try {
      const { full_name, username, password_initial, sector_id, active, must_change_password, actor_id } = req.body;

      const url = process.env.VITE_SUPABASE_URL || '';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (!url || !serviceKey) {
        return res.status(500).json({ error: "Supabase service credentials not configured on server" });
      }

      const supabaseAdmin = createClient(url, serviceKey);

      // Verify actor is an admin
      const { data: actorProfile, error: actorError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", actor_id)
        .single();

      if (actorError || !actorProfile || actorProfile.role !== "admin") {
        return res.status(403).json({ error: "Acesso não autorizado. Apenas administradores podem criar guardiões." });
      }

      // Check if username already exists
      const { data: existingUser } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já está em uso." });
      }

      const fakeEmail = `${username.toLowerCase()}@hotelreviews.com`;
      let createdNewAuthUser = true;
      let { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: fakeEmail,
        password: password_initial,
        email_confirm: true,
        user_metadata: { role: "guardian", full_name }
      });

      if (authError || !authUser.user) {
        const authMessage = authError?.message || "";
        const canRecoverExistingAuth = authMessage.toLowerCase().includes("already") || authMessage.toLowerCase().includes("registered");
        if (!canRecoverExistingAuth) {
          return res.status(400).json({ error: `Erro ao registrar no Auth: ${authMessage}` });
        }

        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
          return res.status(400).json({ error: `Usuario ja existe no Auth, mas nao foi possivel recuperar: ${listError.message}` });
        }

        const existingAuthUser = (usersData.users as Array<{ id: string; email?: string | null }>).find(user => user.email?.toLowerCase() === fakeEmail.toLowerCase());
        if (!existingAuthUser) {
          return res.status(400).json({ error: "Usuario ja existe no Auth, mas nao foi localizado para sincronizar o perfil." });
        }

        createdNewAuthUser = false;
        const { data: updatedAuth, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
          password: password_initial,
          email_confirm: true,
          user_metadata: { role: "guardian", full_name, username, must_change_password }
        });

        if (updateAuthError || !updatedAuth.user) {
          return res.status(400).json({ error: `Erro ao atualizar credenciais existentes: ${updateAuthError?.message || "usuario nulo"}` });
        }

        authUser = updatedAuth;
      }

      // Insert user profile in public.profiles table
      const insertPayload: any = {
        id: authUser.user.id,
        full_name,
        username,
        role: "guardian",
        sector_id: sector_id || null,
        active,
        must_change_password
      };
      if (req.body.avatar_url !== undefined) {
        insertPayload.avatar_url = req.body.avatar_url;
      }

      let { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (profileError && profileError.message.includes('avatar_url')) {
        delete insertPayload.avatar_url;
        const retry = await supabaseAdmin
          .from("profiles")
          .insert(insertPayload)
          .select()
          .maybeSingle();
        profile = retry.data;
        profileError = retry.error;
      }

      if (profileError) {
        // rollback auth user if profile insertion failed
        if (createdNewAuthUser) {
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        }
        return res.status(400).json({ error: `Erro ao criar perfil: ${profileError.message}` });
      }

      // Log action to audit_logs
      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: actor_id,
        action: "criação de guardião",
        entity_type: "profiles",
        entity_id: profile.id,
        metadata: { full_name, username }
      });

      return res.json({ user: profile });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // API Route to Update Guardian safely from server side using admin privileges
  app.post("/api/update-guardian", async (req, res) => {
    try {
      const { target_id, update_fields, actor_id } = req.body;

      const url = process.env.VITE_SUPABASE_URL || '';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (!url || !serviceKey) {
        return res.status(500).json({ error: "Supabase service credentials not configured on server" });
      }

      const supabaseAdmin = createClient(url, serviceKey);

      // Verify actor is an admin
      const { data: actorProfile, error: actorError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", actor_id)
        .single();

      if (actorError || !actorProfile || actorProfile.role !== "admin") {
        return res.status(403).json({ error: "Acesso não autorizado. Apenas administradores podem atualizar guardiões." });
      }

      // 1. If there's a new password, update GoTrue user password
      if (update_fields.password_new) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(target_id, {
          password: update_fields.password_new
        });
        if (authError) {
          return res.status(400).json({ error: `Erro ao atualizar senha no Auth: ${authError.message}` });
        }
      }

      // 2. Prepare database updates for profiles
      const filteredUpdate: Record<string, any> = {};
      if (update_fields.full_name !== undefined) filteredUpdate.full_name = update_fields.full_name;
      if (update_fields.username !== undefined) filteredUpdate.username = update_fields.username;
      if (update_fields.sector_id !== undefined) filteredUpdate.sector_id = update_fields.sector_id;
      if (update_fields.active !== undefined) filteredUpdate.active = update_fields.active;
      if (update_fields.must_change_password !== undefined) filteredUpdate.must_change_password = update_fields.must_change_password;
      if (update_fields.avatar_url !== undefined) filteredUpdate.avatar_url = update_fields.avatar_url;

      filteredUpdate.updated_at = new Date().toISOString();

      // 3. Update profiles table
      let { data: profile, error: dbError } = await supabaseAdmin
        .from('profiles')
        .update(filteredUpdate)
        .eq('id', target_id)
        .select()
        .maybeSingle();

      if (dbError && dbError.message.includes('avatar_url')) {
        delete filteredUpdate.avatar_url;
        const retry = await supabaseAdmin
          .from('profiles')
          .update(filteredUpdate)
          .eq('id', target_id)
          .select()
          .maybeSingle();
        profile = retry.data;
        dbError = retry.error;
      }

      if (dbError) {
        return res.status(400).json({ error: `Erro ao atualizar perfil no banco de dados: ${dbError.message}` });
      }

      // 4. Log audit log
      await supabaseAdmin.from('audit_logs').insert({
        actor_user_id: actor_id,
        action: 'edição de guardião',
        entity_type: 'profiles',
        entity_id: target_id,
        metadata: { update_columns: Object.keys(filteredUpdate) }
      });

      return res.json({ user: profile });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/profiles-visible", async (req, res) => {
    try {
      const url = process.env.VITE_SUPABASE_URL || "";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
      if (!url || !serviceKey || !anonKey) {
        return res.status(500).json({ error: "Supabase credentials not configured on server" });
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

      return res.json({ profiles: data || [] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/invites-visible", async (req, res) => {
    try {
      const url = process.env.VITE_SUPABASE_URL || "";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
      if (!url || !serviceKey || !anonKey) {
        return res.status(500).json({ error: "Supabase credentials not configured on server" });
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

      const { data, error } = await supabaseAdmin
        .from("review_invites")
        .select("id, issuer_user_id, issuer_sector_id, platform_id, method, status, opened_count, first_opened_at, last_opened_at, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const invites = (data || []).map((invite: any) => ({
        ...invite,
        token: "",
        guest_phone_masked: null,
        guest_name: null,
        room_number: null
      }));

      return res.json({ invites });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/roulette-options", async (req, res) => {
    try {
      const url = process.env.VITE_SUPABASE_URL || "";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
      if (!url || !serviceKey || !anonKey) {
        return res.status(500).json({ error: "Supabase credentials not configured on server" });
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
      const { data, error } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "roulette_options")
        .maybeSingle();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const options = Array.isArray(data?.value?.options)
        ? data.value.options
        : [
            { id: "late-check-out", label: "Late check out", active: true },
            { id: "espumante", label: "Espumante", active: true },
            { id: "mesa-found", label: "Mesa de found", active: true },
            { id: "cafe-1kg", label: "1kg de café", active: true },
            { id: "nada", label: "Nada", active: true }
          ];

      return res.json({ options });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/roulette-options", async (req, res) => {
    try {
      const url = process.env.VITE_SUPABASE_URL || "";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
      if (!url || !serviceKey || !anonKey) {
        return res.status(500).json({ error: "Supabase credentials not configured on server" });
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

      if (actorError || !actorProfile || actorProfile.role !== "admin") {
        return res.status(403).json({ error: "Apenas administradores podem alterar a roleta." });
      }

      const options = Array.isArray(req.body?.options)
        ? req.body.options
            .map((option: any, index: number) => ({
              id: String(option.id || `opt-${Date.now()}-${index}`).trim(),
              label: String(option.label || "").trim(),
              active: option.active !== false
            }))
            .filter((option: any) => option.label.length > 0)
        : [];

      if (options.length < 2) {
        return res.status(400).json({ error: "Cadastre pelo menos duas opcoes para a roleta." });
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

      return res.json({ success: true, options });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback all other routes to transform and serve index.html in dev mode
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await fs.promises.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
