import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: fakeEmail,
        password: password_initial,
        email_confirm: true,
        user_metadata: { role: "guardian", full_name }
      });

      if (authError || !authUser.user) {
        return res.status(400).json({ error: `Erro ao registrar no Auth: ${authError?.message}` });
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
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
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
