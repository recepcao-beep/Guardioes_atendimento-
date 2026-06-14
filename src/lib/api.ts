import { supabase, isDemoMode } from './supabase';
import { DemoDb } from '../utils/demoDb';
import { 
  Sector, Profile, Platform, ReviewInvite, 
  InternalReview, ExternalReviewConfirmation, MonthlyPrize, 
  AuditLog, PlatformCode, InviteStatus, Complaint, ComplaintStatus
} from '../types';

// Helper to determine the logged-in user in client state
let currentSessionUser: Profile | null = null;
const SESSION_KEY = 'hotel_reviews_current_user';

export const getSessionUser = (): Profile | null => {
  if (currentSessionUser) return currentSessionUser;
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved) {
    try {
      currentSessionUser = JSON.parse(saved);
      return currentSessionUser;
    } catch {
      return null;
    }
  }
  return null;
};

export const setSessionUser = (user: Profile | null) => {
  currentSessionUser = user;
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
};

export class ApiService {
  // --- SESSION & LOGIN SYSTEM ---
  static async login(username: string, passwordField: string): Promise<{ user: Profile | null; error: string | null }> {
    const normalizedUser = username.trim().toLowerCase().split('@')[0].trim().replace(/[^a-z0-9._-]/g, '');

    if (isDemoMode) {
      const res = DemoDb.loginUser(normalizedUser, passwordField);
      if (res.user) {
        setSessionUser(res.user);
      }
      return Promise.resolve(res);
    }

    try {
      if (!supabase) throw new Error('Supabase cliente não está inicializado.');

      // Special case: admin login via custom schema
      if (normalizedUser === 'admin') {
        const email = 'admin@hotelreviews.internal';
        // Try authenticating with Supabase Auth to get a real JWT session first
        let loginResult = await supabase.auth.signInWithPassword({
          email,
          password: passwordField
        });

        // Se o admin não existir ou houver erro de credencial por conta de banco recriado,
        // realizamos o cadastro nativo síncrono para garantir a sincronização com o GoTrue
        if (loginResult.error && (
            loginResult.error.message.includes('Invalid login credentials') || 
            loginResult.error.message.includes('Email not confirmed') ||
            loginResult.error.message.includes('User not found') ||
            loginResult.error.status === 400 ||
            loginResult.error.status === 500
          )) {
          console.warn("Primeiro login do Admin falhou ou usuário inexistente na base atual. Automatizando registro nativo via GoTrue...");
          try {
            const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
              email,
              password: passwordField,
              options: {
                data: {
                  role: 'admin',
                  full_name: 'Super Admin',
                  username: 'admin',
                  must_change_password: (passwordField === '0000')
                }
              }
            });

            if (!signUpErr && signUpData.user) {
              console.log("Admin autocadastrado nativamente com sucesso! Retentando login...");
              loginResult = await supabase.auth.signInWithPassword({
                email,
                password: passwordField
              });
            } else if (signUpErr) {
              console.warn("Erro no cadastro síncrono do admin, tentando RPC de fallback...", signUpErr.message);
            }
          } catch (regErr) {
            console.error("Falha silenciosa durante autocadastro do admin:", regErr);
          }
        }

        const { data: authData, error: authError } = loginResult;

        if (authError) {
          console.warn("Auth sign-in failed for admin, falling back to secure RPC...", authError.message);
          // Fallback to custom secure RPC if profile did not get synced or setup yet
          const { data, error } = await supabase.rpc('login_admin_secure', { password_field: passwordField });
          if (error) throw error;
          if (data && data.success) {
            const adminUser = data.user || {
              id: 'e71f9cfd-114c-4e89-9a74-d022b7a0d0d0',
              full_name: 'Super Admin',
              username: 'admin',
              role: 'admin',
              sector_id: null,
              active: true,
              must_change_password: (passwordField === '0000')
            };
            setSessionUser(adminUser);
            return { user: adminUser, error: null };
          }
          return { user: null, error: 'Senha incorreta ou erro de rede administradora.' };
        }

        if (authData.user) {
          // Verify profile exists in public.profiles
          const { data: profile, error: pError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          if (pError || !profile) {
            console.warn("Admin profile not found in public.profiles, trying to sync on the fly...", pError?.message);
            
            // Garantir que seu correspondente em public.profiles esteja criado/atualizado
            try {
              const { data: newProfile, error: syncError } = await supabase
                .from('profiles')
                .insert({
                  id: authData.user.id,
                  full_name: 'Super Admin',
                  username: 'admin',
                  role: 'admin',
                  sector_id: null,
                  active: true,
                  must_change_password: (passwordField === '0000')
                })
                .select()
                .single();
              
              if (!syncError && newProfile) {
                setSessionUser(newProfile);
                return { user: newProfile, error: null };
              }
            } catch (syncErr) {
              console.error("Erro ao sincronizar perfil on-the-fly:", syncErr);
            }

            const { data, error } = await supabase.rpc('login_admin_secure', { password_field: passwordField });
            if (error) throw error;
            if (data && data.success) {
              const adminUser = data.user || {
                id: 'e71f9cfd-114c-4e89-9a74-d022b7a0d0d0',
                full_name: 'Super Admin',
                username: 'admin',
                role: 'admin',
                sector_id: null,
                active: true,
                must_change_password: (passwordField === '0000')
              };
              setSessionUser(adminUser);
              return { user: adminUser, error: null };
            }
            return { user: null, error: 'Perfil do administrador não pode ser criado em public.profiles.' };
          }

          // Call secure RPC as side-effect to record audit logs & update last_login_at
          try {
            await supabase.rpc('login_admin_secure', { password_field: passwordField });
          } catch (e) {
            console.warn("Audit logging from login_admin_secure failed", e);
          }

          setSessionUser(profile);
          return { user: profile, error: null };
        }
      }

      // Normal guardian login
      // Sign in via Supabase Auth - Prefer .com but fallback to .internal for legacy creations
      const email = `${normalizedUser}@hotelreviews.com`;
      let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: passwordField
      });

      if (authError) {
        // Fallback for any legacy internal domain formatted accounts
        const fallbackEmail = `${normalizedUser}@hotelreviews.internal`;
        const { data: fallbackData, error: fallbackError } = await supabase.auth.signInWithPassword({
          email: fallbackEmail,
          password: passwordField
        });
        if (!fallbackError && fallbackData?.user) {
          authData = fallbackData;
          authError = null;
        }
      }

      if (authError) {
        return { user: null, error: 'Credenciais inválidas ou usuário inativo.' };
      }

      if (authData.user) {
        // Query Profile
        const { data: profile, error: pError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (pError || !profile) {
          return { user: null, error: 'Perfil do guardião não encontrado.' };
        }

        if (!profile.active) {
          await supabase.auth.signOut();
          return { user: null, error: 'Sua conta está inativa.' };
        }

        setSessionUser(profile);
        return { user: profile, error: null };
      }
      return { user: null, error: 'Erro de login desconhecido.' };
    } catch (err: any) {
      console.error('Login error', err);
      return { user: null, error: err.message || 'Falha ao conectar com o banco.' };
    }
  }

  static async changePassword(profileId: string, inputOld: string, inputNew: string): Promise<{ success: boolean; error: string | null }> {
    const actor = getSessionUser();
    if (isDemoMode) {
      if (actor && actor.role === 'admin') {
        const currentAdminPass = DemoDb.getAdminPassword();
        if (inputOld !== currentAdminPass) {
          return { success: false, error: 'Senha antiga incorreta.' };
        }
        DemoDb.saveAdminPassword(inputNew);
        if (currentSessionUser) currentSessionUser.must_change_password = false;
        setSessionUser(currentSessionUser);
        DemoDb.addAuditLog(profileId, 'Super Admin', 'redefinição de senha', 'profiles', profileId, { msg: 'Troca de senha inicial realizada com sucesso!' });
        return { success: true, error: null };
      } else {
        // guardian password update
        const passwords = JSON.parse(localStorage.getItem('hotel_reviews_user_passes') || '{}');
        const correct = passwords[profileId] || '1234';
        if (inputOld !== correct) return { success: false, error: 'Senha antiga incorreta.' };
        passwords[profileId] = inputNew;
        localStorage.setItem('hotel_reviews_user_passes', JSON.stringify(passwords));
        
        const profiles = DemoDb.getProfiles();
        const updated = profiles.map(p => {
          if (p.id === profileId) return { ...p, must_change_password: false };
          return p;
        });
        DemoDb.saveProfiles(updated);
        
        if (currentSessionUser) {
          currentSessionUser.must_change_password = false;
          setSessionUser(currentSessionUser);
        }
        DemoDb.addAuditLog(profileId, currentSessionUser?.full_name || 'Guardião', 'redefinição de senha', 'profiles', profileId);
        return { success: true, error: null };
      }
    }

    try {
      if (!supabase) throw new Error('Supabase cliente não está inicializado.');
      
      // If administrative user, update the app_settings credentials as well
      if (actor && actor.role === 'admin') {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('update_admin_password_secure', {
          old_password: inputOld,
          new_password: inputNew
        });
        if (rpcErr) throw rpcErr;
        if (rpcData && !rpcData.success) {
          throw new Error(rpcData.error || 'Erro ao redefinir a senha do admin.');
        }
      }

      const { error } = await supabase.auth.updateUser({ password: inputNew });
      if (error) throw error;

      // Update profiles setting must_change_password to false
      const { error: pError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', profileId);

      if (pError) throw pError;

      if (currentSessionUser) {
        currentSessionUser.must_change_password = false;
        setSessionUser(currentSessionUser);
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  static async logout(): Promise<void> {
    const actor = getSessionUser();
    if (isDemoMode) {
      if (actor) {
        DemoDb.addAuditLog(actor.id, actor.full_name, 'logout', 'auth', null);
      }
      setSessionUser(null);
      return Promise.resolve();
    }

    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Logout error', err);
    }
    setSessionUser(null);
  }

  // --- SECTORS API ---
  static async getSectors(): Promise<Sector[]> {
    if (isDemoMode) {
      return Promise.resolve(DemoDb.getSectors());
    }
    try {
      const { data, error } = await supabase!.from('sectors').select('*').order('name');
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Database connection failed, falling back to LocalStorage', e);
      return DemoDb.getSectors();
    }
  }

  static async createSector(name: string): Promise<Sector> {
    const actor = getSessionUser();
    if (isDemoMode || !actor) {
      const parent = actor || { id: 'admin', full_name: 'Admin' };
      return Promise.resolve(DemoDb.createSector(parent as Profile, name));
    }
    const { data, error } = await supabase!
      .from('sectors')
      .insert({ name, active: true })
      .select()
      .single();
    if (error) throw error;
    
    // audit logs
    await supabase!.from('audit_logs').insert({
      actor_user_id: actor.id,
      action: 'criação de setor',
      entity_type: 'sectors',
      entity_id: data.id,
      metadata: { name }
    });

    return data;
  }

  static async updateSector(id: string, name: string, active: boolean): Promise<Sector> {
    const actor = getSessionUser();
    if (isDemoMode || !actor) {
      const parent = actor || { id: 'admin', full_name: 'Admin' };
      return Promise.resolve(DemoDb.updateSector(parent as Profile, id, name, active));
    }
    const { data, error } = await supabase!
      .from('sectors')
      .update({ name, active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await supabase!.from('audit_logs').insert({
      actor_user_id: actor.id,
      action: 'edição de setor',
      entity_type: 'sectors',
      entity_id: id,
      metadata: { name, active }
    });

    return data;
  }

  static async deleteSector(id: string): Promise<boolean> {
    const actor = getSessionUser();
    if (isDemoMode || !actor) {
      const parent = actor || { id: 'admin', full_name: 'Admin' };
      return Promise.resolve(DemoDb.deleteSector(parent as Profile, id));
    }
    const { error } = await supabase!
      .from('sectors')
      .delete()
      .eq('id', id);
    if (error) throw error;

    await supabase!.from('audit_logs').insert({
      actor_user_id: actor.id,
      action: 'exclusão de setor',
      entity_type: 'sectors',
      entity_id: id,
      metadata: { id }
    });

    return true;
  }

  // --- GUARDIANS (PROFILES) API ---
  static async getProfiles(): Promise<Profile[]> {
    if (isDemoMode) {
      return Promise.resolve(DemoDb.getProfiles());
    }
    try {
      const { data, error } = await supabase!.from('profiles').select('*').order('full_name');
      if (error) throw error;
      return data || [];
    } catch (e) {
      return DemoDb.getProfiles();
    }
  }

  static async createGuardian(data: { full_name: string; username: string; password_initial: string; sector_id: string; active: boolean; must_change_password: boolean; avatar_url?: string | null }): Promise<Profile> {
    const actor = getSessionUser()!;
    // Clean and normalize username (lowercase, trim, strip email domain, remove invalid chars)
    const normalizedUsername = data.username.trim().toLowerCase().split('@')[0].trim().replace(/[^a-z0-9._-]/g, '');
    const sanitizedData = { ...data, username: normalizedUsername };

    if (isDemoMode) {
      const res = DemoDb.createGuardian(actor as Profile, sanitizedData);
      if (res.error) throw new Error(res.error);
      return Promise.resolve(res.user!);
    }

    try {
      // 1. Try to call the secure full-stack local server API first!
      const response = await fetch('/api/create-guardian', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...sanitizedData, actor_id: actor.id })
      });

      if (response.ok) {
        const resJson = await response.json();
        if (resJson.error) {
          throw new Error(resJson.error);
        }
        return resJson.user;
      } else {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro de requisição ao servidor local: ${response.status}`);
      }
    } catch (err: any) {
      console.warn("Local full-stack registration failed, attempting fallbacks...", err);
      // Propagate critical validation errors directly back to the user
      if (err.message && (err.message.includes('em uso') || err.message.includes('não autorizado') || err.message.includes('Auth'))) {
        throw err;
      }

      try {
        // Call Supabase Edge Function 'create-guardian'
        const { data: edgeRes, error: edgeError } = await supabase!.functions.invoke('create-guardian', {
          body: { ...sanitizedData, actor_id: actor.id }
        });

        if (edgeError || (edgeRes && edgeRes.error)) {
          throw new Error((edgeRes && edgeRes.error) || edgeError?.message || 'Edge Function failed');
        }

        return edgeRes.user;
      } catch (innerErr: any) {
        console.warn("Edge Function 'create-guardian' failed too. Running client-side direct fallback...", innerErr);

        // Fallback: use standard signup to register credentials, with persistSession: false to preserve current session
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
        const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

        const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });

        const fakeEmail = `${sanitizedData.username.toLowerCase()}@hotelreviews.com`;

        // 1. Re-verify if username already exists in profiles
        const { data: existingUser, error: checkErr } = await supabase!
          .from('profiles')
          .select('id')
          .eq('username', sanitizedData.username)
          .maybeSingle();

        if (existingUser) {
          throw new Error('Nome de usuário já está em uso.');
        }

        // 2. Sign up the user
        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: fakeEmail,
          password: sanitizedData.password_initial,
          options: {
            data: {
              role: 'guardian',
              full_name: sanitizedData.full_name
            }
          }
        });

        if (authError || !authData.user) {
          throw new Error(`Erro ao registrar credenciais: ${authError?.message || 'auth.user nulo'}`);
        }

        // 3. Insert user profile into public.profiles
        let profile: any = null;
        const insertPayload: Record<string, any> = {
          id: authData.user.id,
          full_name: sanitizedData.full_name,
          username: sanitizedData.username,
          role: 'guardian',
          sector_id: sanitizedData.sector_id,
          active: sanitizedData.active,
          must_change_password: sanitizedData.must_change_password
        };
        if (sanitizedData.avatar_url !== undefined) {
          insertPayload.avatar_url = sanitizedData.avatar_url;
        }

        let { data: directProfile, error: profileError } = await supabase!
          .from('profiles')
          .insert(insertPayload)
          .select()
          .maybeSingle();

        if (profileError && profileError.message.includes('avatar_url')) {
          delete insertPayload.avatar_url;
          const retry = await supabase!
            .from('profiles')
            .insert(insertPayload)
            .select()
            .maybeSingle();
          directProfile = retry.data;
          profileError = retry.error;
        }

        if (profileError) {
          console.warn("Direct profiles insert failed, invoking RPC helper 'create_guardian_profile_secure'...", profileError.message);
          const { data: rpcRes, error: rpcErr } = await supabase!.rpc('create_guardian_profile_secure', {
            new_id: authData.user.id,
            f_name: sanitizedData.full_name,
            u_name: sanitizedData.username,
            s_id: sanitizedData.sector_id,
            act: sanitizedData.active,
            must_change: sanitizedData.must_change_password
          });

          if (rpcErr || (rpcRes && rpcRes.success === false)) {
            throw new Error(`Erro ao salvar perfil no banco de dados (RLS pode necessitar de privilégios de admin): ${rpcErr?.message || rpcRes?.error || profileError.message}`);
          }
          profile = rpcRes.profile;
        } else {
          profile = directProfile;
        }

        // 4. Log action to audit_logs
        try {
          await supabase!.from('audit_logs').insert({
            actor_user_id: actor.id,
            action: 'criação de guardião',
            entity_type: 'profiles',
            entity_id: profile.id,
            metadata: { full_name: sanitizedData.full_name, username: sanitizedData.username, fallback: true }
          });
        } catch (logErr) {
          console.warn("Audit log insert failed, skipping...", logErr);
        }

        return profile;
      }
    }
  }

  static async updateGuardian(targetId: string, data: Partial<Profile & { password_new?: string; password_old?: string }>): Promise<Profile> {
    const actor = getSessionUser()!;
    const sanitizedFields = { ...data };
    if (sanitizedFields.username !== undefined) {
      sanitizedFields.username = sanitizedFields.username.trim().toLowerCase().split('@')[0].trim().replace(/[^a-z0-9._-]/g, '');
    }

    if (isDemoMode) {
      const res = DemoDb.updateGuardian(actor as Profile, targetId, sanitizedFields);
      if (res.error) throw new Error(res.error);
      return Promise.resolve(res.user!);
    }

    try {
      // 1. Try to call the secure full-stack local server API first!
      const response = await fetch('/api/update-guardian', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ target_id: targetId, update_fields: sanitizedFields, actor_id: actor.id })
      });

      if (response.ok) {
        const resJson = await response.json();
        if (resJson.error) {
          throw new Error(resJson.error);
        }
        return resJson.user;
      } else {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro de requisição ao servidor local: ${response.status}`);
      }
    } catch (err: any) {
      console.warn("Local full-stack update failed, attempting fallbacks...", err);
      // Propagate critical validation errors directly back to the user
      if (err.message && (err.message.includes('não autorizado') || err.message.includes('em uso') || err.message.includes('Auth'))) {
        throw err;
      }

      try {
        // Call Supabase Edge Function 'update-guardian'
        const { data: edgeRes, error: edgeError } = await supabase!.functions.invoke('update-guardian', {
          body: { target_id: targetId, update_fields: sanitizedFields, actor_id: actor.id }
        });

        if (edgeError || (edgeRes && edgeRes.error)) {
          throw new Error((edgeRes && edgeRes.error) || edgeError?.message || 'Edge Function failed');
        }

        return edgeRes.user;
      } catch (innerErr: any) {
        console.warn("Edge Function 'update-guardian' failed too. Running client-side direct fallback...", innerErr);

        // 1. If updating their own admin credentials (which are validated against public.app_settings)
        if (actor.role === 'admin' && targetId === actor.id && sanitizedFields.password_new) {
          // Try calling the secure RPC first to bypass RLS since guest admin has no standard auth session
          const { data: rpcRes, error: rpcErr } = await supabase!.rpc('update_admin_password_secure', {
            old_password: sanitizedFields.password_old || '0000',
            new_password: sanitizedFields.password_new
          });

          if (rpcErr || (rpcRes && rpcRes.success === false)) {
            console.warn("RPC 'update_admin_password_secure' not found or failed, trying direct upsert...", rpcErr || rpcRes?.error);

            const { error: appErr } = await supabase!
              .from('app_settings')
              .upsert({
                key: 'admin_password_secret',
                value: { password: sanitizedFields.password_new },
                updated_at: new Date().toISOString()
              });

            if (appErr) {
              throw new Error(`Sem privilégio de salvar nova senha para Admin no app_settings. Execute o script SQL no Panel do Supabase. Erro: ${appErr.message}`);
            }
          } else {
            // Success! Fetch the updated profile to return
            const { data: updatedProf } = await supabase!
              .from('profiles')
              .select('*')
              .eq('id', targetId)
              .maybeSingle();
            if (updatedProf) {
              return updatedProf;
            }
          }
        }

        // 2. Prepare database updates for profiles
        const filteredUpdate: Record<string, any> = {};
        if (sanitizedFields.full_name !== undefined) filteredUpdate.full_name = sanitizedFields.full_name;
        if (sanitizedFields.username !== undefined) filteredUpdate.username = sanitizedFields.username;
        if (sanitizedFields.sector_id !== undefined) filteredUpdate.sector_id = sanitizedFields.sector_id;
        if (sanitizedFields.active !== undefined) filteredUpdate.active = sanitizedFields.active;
        if (sanitizedFields.must_change_password !== undefined) filteredUpdate.must_change_password = sanitizedFields.must_change_password;
        if (sanitizedFields.avatar_url !== undefined) filteredUpdate.avatar_url = sanitizedFields.avatar_url;

        filteredUpdate.updated_at = new Date().toISOString();

        // 3. Update profiles table
        let profile: any = null;
        let { data: directProfile, error: dbError } = await supabase!
          .from('profiles')
          .update(filteredUpdate)
          .eq('id', targetId)
          .select()
          .maybeSingle();

        if (dbError && dbError.message.includes('avatar_url')) {
          delete filteredUpdate.avatar_url;
          const retry = await supabase!
            .from('profiles')
            .update(filteredUpdate)
            .eq('id', targetId)
            .select()
            .maybeSingle();
          directProfile = retry.data;
          dbError = retry.error;
        }

        if (dbError) {
          console.warn("Direct profiles update failed, invoking RPC helper 'update_guardian_profile_secure'...", dbError.message);

          const { data: rpcRes, error: rpcErr } = await supabase!.rpc('update_guardian_profile_secure', {
            target_id: targetId,
            f_name: sanitizedFields.full_name || null,
            u_name: sanitizedFields.username || null,
            s_id: sanitizedFields.sector_id || null,
            act: sanitizedFields.active !== undefined ? sanitizedFields.active : null,
            must_change: sanitizedFields.must_change_password !== undefined ? sanitizedFields.must_change_password : null
          });

          if (rpcErr || (rpcRes && rpcRes.success === false)) {
            throw new Error(`Erro ao atualizar perfil no banco de dados (RLS pode necessitar de privilégios de admin): ${rpcErr?.message || rpcRes?.error || dbError.message}`);
          }
          profile = rpcRes.profile;
        } else {
          profile = directProfile;
        }

        // 4. Log audit log
        try {
          await supabase!.from('audit_logs').insert({
            actor_user_id: actor.id,
            action: 'edição de guardião',
            entity_type: 'profiles',
            entity_id: targetId,
            metadata: { update_columns: Object.keys(filteredUpdate), fallback: true }
          });
        } catch (logErr) {
          console.warn("Audit log insert failed, skipping...", logErr);
        }

        return profile;
      }
    }
  }

  // --- PLATFORMS ---
  static async getPlatforms(): Promise<Platform[]> {
    if (isDemoMode) {
      return Promise.resolve(DemoDb.getPlatforms());
    }
    try {
      const { data, error } = await supabase!
        .from('platforms')
        .select('*')
        .order('display_order');
      if (error) throw error;
      const list = data || [];
      return list.filter((p: any) => p.code !== 'booking');
    } catch {
      return DemoDb.getPlatforms();
    }
  }

  static async updatePlatform(id: string, data: Partial<Platform>): Promise<Platform> {
    const actor = getSessionUser()!;
    if (isDemoMode) {
      return Promise.resolve(DemoDb.updatePlatform(actor as Profile, id, data));
    }
    const { data: updated, error } = await supabase!
      .from('platforms')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await supabase!.from('audit_logs').insert({
      actor_user_id: actor.id,
      action: 'configuração de plataforma',
      entity_type: 'platforms',
      entity_id: id,
      metadata: { items: Object.keys(data) }
    });

    return updated;
  }

  // --- REVIEW INVITES ---
  static async getInvites(): Promise<ReviewInvite[]> {
    if (isDemoMode) {
      return Promise.resolve(DemoDb.getInvites());
    }
    try {
      const { data, error } = await supabase!.from('review_invites').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch {
      return DemoDb.getInvites();
    }
  }

  static async createInvite(
    platformCode: PlatformCode, 
    method: 'qr' | 'whatsapp' | 'assisted', 
    guestPhone?: string,
    guestName?: string,
    roomNumber?: string,
    complaintDescription?: string
  ): Promise<ReviewInvite> {
    const actor = getSessionUser()!;
    if (isDemoMode) {
      return Promise.resolve(DemoDb.createInvite(actor, platformCode, method, guestPhone, guestName, roomNumber, complaintDescription));
    }

    // Call track redirect mapping / database creation
    const { data: platforms } = await supabase!.from('platforms').select('*').eq('code', platformCode).single();
    if (!platforms) throw new Error('Plataforma indisponível');

    // Generating unique secure token and insert
    const token = `tok-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    let maskedPhone: string | null = null;
    if (guestPhone) {
      const clean = guestPhone.replace(/\D/g, '');
      if (clean.length >= 8) {
        const ddd = clean.length > 9 ? clean.substr(2, 2) : clean.substr(0, 2);
        const lastFour = clean.substr(clean.length - 4);
        maskedPhone = `+55 (${ddd}) 9****-${lastFour}`;
      } else {
        maskedPhone = guestPhone;
      }
    }

    let data;
    let error;

    try {
      const res = await supabase!
        .from('review_invites')
        .insert({
          token,
          issuer_user_id: actor.id,
          issuer_sector_id: actor.sector_id,
          platform_id: platforms.id,
          method,
          guest_phone_masked: maskedPhone,
          guest_name: guestName || null,
          room_number: roomNumber || null,
          status: 'emitted',
          opened_count: 0
        })
        .select()
        .single();
      data = res.data;
      error = res.error;
    } catch (e: any) {
      error = e;
    }

    if (error) {
      const errStr = String(error.message || error.details || error || '');
      if (errStr.includes('guest_name') || errStr.includes('room_number') || errStr.includes('PGRST204')) {
        console.warn("Colunas de guest_name/room_number não encontradas no Supabase. Utilizando fallback resiliente...");
        const resFallback = await supabase!
          .from('review_invites')
          .insert({
            token,
            issuer_user_id: actor.id,
            issuer_sector_id: actor.sector_id,
            platform_id: platforms.id,
            method,
            guest_phone_masked: maskedPhone,
            status: 'emitted',
            opened_count: 0
          })
          .select()
          .single();
        
        if (resFallback.error) throw resFallback.error;
        data = resFallback.data;
        
        if (data) {
          data.guest_name = guestName || null;
          data.room_number = roomNumber || null;
        }
      } else {
        throw error;
      }
    }

    // Now insert the optional complaint if supplied
    if (complaintDescription && complaintDescription.trim().length > 0) {
      try {
        await supabase!
          .from('complaints')
          .insert({
            invite_id: data.id,
            guest_name: guestName || 'Hóspede',
            room_number: roomNumber || 'N/A',
            description: complaintDescription.trim(),
            status: 'pending'
          });
      } catch (err) {
        console.warn("Erro ao inserir reclamação de forma síncrona no Supabase:", err);
      }
    }

    // Log the event with full metadata
    await supabase!.from('review_events').insert({
      invite_id: data.id,
      actor_user_id: actor.id,
      event_type: 'invite_created',
      metadata: { 
        platform: platformCode, 
        method,
        guest_name: guestName || null,
        room_number: roomNumber || null
      }
    });

    await supabase!.from('audit_logs').insert({
      actor_user_id: actor.id,
      action: 'emissão de convite',
      entity_type: 'review_invites',
      entity_id: data.id,
      metadata: { 
        platform: platformCode, 
        method,
        guest_name: guestName || null,
        room_number: roomNumber || null
      }
    });

    return data;
  }

  // --- REDIRECT PATH (/r/:token) ---
  static async trackRedirect(token: string): Promise<{ url: string; invite: ReviewInvite | null; error: string | null }> {
    if (isDemoMode) {
      return Promise.resolve(DemoDb.trackRedirect(token));
    }

    try {
      // Direct call to edge function track-redirect
      const { data, error } = await supabase!.functions.invoke('track-redirect', {
        body: { token }
      });
      if (error || (data && data.error)) {
        throw new Error(data?.error || error.message);
      }
      return { url: data.url, invite: data.invite, error: null };
    } catch (e: any) {
      console.warn("Edge Function 'track-redirect' failed or is not deployed. Running database fallback...", e);
      try {
        const { data: invite, error: inviteError } = await supabase!
          .from("review_invites")
          .select("*, platforms(code, external_url)")
          .eq("token", token)
          .maybeSingle();

        if (inviteError || !invite) {
          return { url: '', invite: null, error: inviteError?.message || 'Token de convite inválido ou inexistente.' };
        }

        if (invite.status === "cancelled") {
          return { url: '', invite: null, error: 'Este convite foi cancelado.' };
        }

        const platform = invite.platforms;
        const now = new Date().toISOString();

        // Update invite counter and update status
        const { data: updatedinvite, error: updateError } = await supabase!
          .from("review_invites")
          .update({
            opened_count: invite.opened_count + 1,
            status: invite.status === "emitted" ? "opened" : invite.status,
            first_opened_at: invite.first_opened_at || now,
            last_opened_at: now
          })
          .eq("id", invite.id)
          .select()
          .single();

        if (updateError) {
          return { url: '', invite: null, error: 'Falha ao registrar abertura do token.' };
        }

        // Insert review event
        await supabase!.from("review_events").insert({
          invite_id: invite.id,
          event_type: "redirect_opened",
          metadata: { date: now, platform_code: (platform as any).code }
        });

         // Determine target URL redirect
         let redirectUrl = (platform as any).external_url;
         if ((platform as any).code === "internal" && (!redirectUrl || redirectUrl.trim() === "" || redirectUrl.includes("avaliacao-interna"))) {
           redirectUrl = `/avaliacao-interna/${token}`;
         }
 
         return { url: redirectUrl, invite: updatedinvite, error: null };
      } catch (err: any) {
        console.error('Database fallback failed, returning DemoDb fallback', err);
        return DemoDb.trackRedirect(token);
      }
    }
  }

  // --- INTERNAL REVIEW SUBMIT ---
  static async submitInternalReview(token: string, fields: { score: number; comment: string; guest_name?: string; room_number?: string; guest_email?: string; consent_given: boolean }): Promise<{ review: InternalReview | null; error: string | null }> {
    if (isDemoMode) {
      return Promise.resolve(DemoDb.submitInternalReview(token, fields));
    }

    try {
      const { data, error } = await supabase!.functions.invoke('submit-internal-review', {
        body: { token, fields }
      });
      if (error || (data && data.error)) {
        throw new Error(data?.error || error.message);
      }
      return { review: data.review, error: null };
    } catch (e: any) {
      console.warn("Edge Function 'submit-internal-review' failed or is not deployed. Running database fallback...", e);
      try {
        const { data: invite, error: inviteError } = await supabase!
          .from("review_invites")
          .select("*")
          .eq("token", token)
          .maybeSingle();

        if (inviteError || !invite) {
          return { review: null, error: "Token inválido ou inexistente." };
        }

        if (invite.status === "internal_completed") {
          return { review: null, error: "Este convite já recebeu uma avaliação interna." };
        }

        const { data: review, error: reviewError } = await supabase!
          .from("internal_reviews")
          .insert({
            invite_id: invite.id,
            score: fields.score,
            comment: fields.comment,
            guest_name: fields.guest_name || null,
            room_number: fields.room_number || null,
            guest_email: fields.guest_email || null,
            consent_given: fields.consent_given
          })
          .select()
          .single();

        if (reviewError) {
          return { review: null, error: `Falha ao salvar avaliação: ${reviewError.message}` };
        }

        // update status to completed
        await supabase!
          .from("review_invites")
          .update({ status: "internal_completed" })
          .eq("id", invite.id);

        // insert event
        await supabase!.from("review_events").insert({
          invite_id: invite.id,
          event_type: "internal_review_completed",
          metadata: { score: fields.score, reviewer: fields.guest_name || "Anônimo" }
        });

        return { review, error: null };
      } catch (err: any) {
        console.error('Database fallback failed, returning DemoDb fallback', err);
        return DemoDb.submitInternalReview(token, fields);
      }
    }
  }

  static async getInternalReviews(): Promise<InternalReview[]> {
    if (isDemoMode) {
      return Promise.resolve(DemoDb.getInternalReviews());
    }
    try {
      const { data, error } = await supabase!.from('internal_reviews').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch {
      return DemoDb.getInternalReviews();
    }
  }

  // --- EXTERNAL RECONCILIATIONS & CONCILIATION ---
  static async getConfirmations(): Promise<ExternalReviewConfirmation[]> {
    if (isDemoMode) {
      return Promise.resolve(DemoDb.getConfirmations());
    }
    try {
      const { data, error } = await supabase!.from('external_review_confirmations').select('*');
      if (error) throw error;
      return data || [];
    } catch {
      return DemoDb.getConfirmations();
    }
  }

  static async confirmExternalReview(inviteId: string, notes: string, reference?: string): Promise<{ confirmation: ExternalReviewConfirmation | null; error: string | null }> {
    const actor = getSessionUser()!;
    if (isDemoMode) {
      return Promise.resolve(DemoDb.confirmExternalReview(actor, inviteId, notes, reference));
    }

    try {
      const { data, error } = await supabase!.functions.invoke('confirm-external-review', {
        body: { invite_id: inviteId, notes, reference, actor_id: actor.id, type: 'confirm' }
      });
      if (error || (data && data.error)) {
        throw new Error(data?.error || error.message);
      }
      return { confirmation: data.confirmation, error: null };
    } catch (e: any) {
      console.warn("Edge Function 'confirm-external-review' failed or is not deployed. Running database fallback...", e);
      try {
        const { data: invite } = await supabase!
          .from("review_invites")
          .select("platform_id")
          .eq("id", inviteId)
          .single();

        const { data: confirmation, error: confError } = await supabase!
          .from("external_review_confirmations")
          .insert({
            invite_id: inviteId,
            platform_id: invite.platform_id,
            confirmation_type: "manual",
            external_review_reference: reference || "Painel Administrativo",
            confirmed_by: actor.full_name,
            notes
          })
          .select()
          .single();

        if (confError) {
          return { confirmation: null, error: `Erro na conciliação no banco: ${confError.message}` };
        }

        // update status to externally_verified_manual
        await supabase!
          .from("review_invites")
          .update({ status: "externally_verified_manual" })
          .eq("id", inviteId);

        // audit log
        await supabase!.from("audit_logs").insert({
          actor_user_id: actor.id,
          action: "confirmação manual de avaliação externa",
          entity_type: "review_invites",
          entity_id: inviteId,
          metadata: { notes, reference, fallback: true }
        });

        return { confirmation, error: null };
      } catch (err: any) {
        console.error('Database fallback failed, returning DemoDb fallback', err);
        return DemoDb.confirmExternalReview(actor, inviteId, notes, reference);
      }
    }
  }

  static async removeExternalConfirmation(inviteId: string): Promise<{ success: boolean; error: string | null }> {
    const actor = getSessionUser()!;
    if (isDemoMode) {
      return Promise.resolve(DemoDb.removeExternalConfirmation(actor, inviteId));
    }

    try {
      const { data, error } = await supabase!.functions.invoke('confirm-external-review', {
        body: { invite_id: inviteId, actor_id: actor.id, type: 'remove' }
      });
      if (error || (data && data.error)) {
        throw new Error(data?.error || error.message);
      }
      return { success: true, error: null };
    } catch (e: any) {
      console.warn("Edge Function 'confirm-external-review' (remove) failed or is not deployed. Running database fallback...", e);
      try {
        const { error: deleteError } = await supabase!
          .from("external_review_confirmations")
          .delete()
          .eq("invite_id", inviteId);

        if (deleteError) {
          return { success: false, error: `Erro ao remover do banco: ${deleteError.message}` };
        }

        // reset invite status back to opened
        await supabase!
          .from("review_invites")
          .update({ status: "opened" })
          .eq("id", inviteId);

        // audit log
        await supabase!.from("audit_logs").insert({
          actor_user_id: actor.id,
          action: "remoção de confirmação",
          entity_type: "review_invites",
          entity_id: inviteId,
          metadata: { fallback: true }
        });

        return { success: true, error: null };
      } catch (err: any) {
        console.error('Database fallback failed, returning DemoDb fallback', err);
        return DemoDb.removeExternalConfirmation(actor, inviteId);
      }
    }
  }

  static async createBookingDirectReview(
    guardianId: string, 
    guestName: string, 
    roomNumber: string, 
    notes: string, 
    ratingValue: number
  ): Promise<{ success: boolean; error: string | null }> {
    const actor = getSessionUser()!;
    if (isDemoMode) {
      return Promise.resolve(DemoDb.createBookingDirectReview(actor, guardianId, guestName, roomNumber, notes, ratingValue));
    }

    try {
      if (!supabase) throw new Error('Supabase cliente não está inicializado.');
      
      // Get Platform ID for booking
      const { data: platform } = await supabase
        .from('platforms')
        .select('*')
        .eq('code', 'booking')
        .single();
        
      if (!platform) throw new Error('Plataforma Booking não cadastrada no banco.');

      // Get Guardian's Profile to read their sector
      const { data: guardian } = await supabase
        .from('profiles')
        .select('sector_id')
        .eq('id', guardianId)
        .single();

      const token = `booking-attr-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Insert review_invite directly
      const { data: invite, error: inviteError } = await supabase
        .from('review_invites')
        .insert({
          token,
          issuer_user_id: guardianId,
          issuer_sector_id: guardian?.sector_id || null,
          platform_id: platform.id,
          method: 'assisted',
          guest_name: guestName,
          room_number: roomNumber || null,
          status: 'externally_verified_manual',
          opened_count: 1,
          first_opened_at: new Date().toISOString(),
          last_opened_at: new Date().toISOString()
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Insert confirmation
      const { error: confError } = await supabase
        .from('external_review_confirmations')
        .insert({
          invite_id: invite.id,
          platform_id: platform.id,
          confirmation_type: 'manual',
          external_review_reference: `Booking.com - Nota ${ratingValue}/10`,
          confirmed_by: actor.full_name,
          notes: notes || 'Atribuição direta de avaliação do Booking.com pelo administrador.'
        });

      if (confError) throw confError;

      // Audit Log
      await supabase.from('audit_logs').insert({
        actor_user_id: actor.id,
        action: 'atribuição direta avaliacao booking',
        entity_type: 'review_invites',
        entity_id: invite.id,
        metadata: { guardianId, guestName, ratingValue }
      });

      return { success: true, error: null };
    } catch (e: any) {
      console.warn("Direct Booking insert failed, trying demo DB fallback", e);
      return DemoDb.createBookingDirectReview(actor, guardianId, guestName, roomNumber, notes, ratingValue);
    }
  }

  static async invalidateInvite(inviteId: string): Promise<{ success: boolean; error: string | null }> {
    const actor = getSessionUser()!;
    if (isDemoMode) {
      return Promise.resolve(DemoDb.invalidateInvite(actor, inviteId));
    }
    try {
      if (!supabase) throw new Error('Supabase cliente não está inicializado.');
      const { error } = await supabase.from('review_invites').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', inviteId);
      if (error) throw error;
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  static async deleteInvite(inviteId: string): Promise<{ success: boolean; error: string | null }> {
    const actor = getSessionUser()!;
    if (isDemoMode) {
      return Promise.resolve(DemoDb.deleteInvite(actor, inviteId));
    }
    try {
      if (!supabase) throw new Error('Supabase cliente não está inicializado.');
      const { error } = await supabase.from('review_invites').delete().eq('id', inviteId);
      if (error) throw error;
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  static async reopenInvite(inviteId: string): Promise<{ success: boolean; error: string | null }> {
    const actor = getSessionUser()!;
    if (isDemoMode) {
      return Promise.resolve(DemoDb.reopenInvite(actor, inviteId));
    }
    try {
      if (!supabase) throw new Error('Supabase cliente não está inicializado.');
      const { error } = await supabase.from('review_invites').update({ status: 'opened', updated_at: new Date().toISOString() }).eq('id', inviteId);
      if (error) throw error;
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  static async updateInviteGuest(inviteId: string, guestName: string, roomNumber: string): Promise<{ success: boolean; error: string | null; invite: ReviewInvite | null }> {
    const actor = getSessionUser()!;
    if (isDemoMode) {
      return Promise.resolve(DemoDb.updateInviteGuest(actor, inviteId, guestName, roomNumber));
    }
    try {
      if (!supabase) throw new Error('Supabase cliente não está inicializado.');
      
      const { data, error } = await supabase
        .from('review_invites')
        .update({ 
          guest_name: guestName, 
          room_number: roomNumber, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', inviteId)
        .select()
        .maybeSingle();

      if (error) throw error;

      // Update matching complaints if any
      await supabase
        .from('complaints')
        .update({
          guest_name: guestName,
          room_number: roomNumber,
          updated_at: new Date().toISOString()
        })
        .eq('invite_id', inviteId);

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_user_id: actor.id,
        action: 'edição de dados do hóspede do convite',
        entity_type: 'review_invites',
        entity_id: inviteId,
        metadata: { guest_name: guestName, room_number: roomNumber }
      });

      return { success: true, error: null, invite: data };
    } catch (e: any) {
      return { success: false, error: e.message, invite: null };
    }
  }

  // --- MONTHLY PRIZES ---
  static async getPrizes(): Promise<MonthlyPrize[]> {
    let rawPrizes: MonthlyPrize[] = [];
    if (isDemoMode) {
      rawPrizes = DemoDb.getPrizes();
    } else {
      try {
        const { data, error } = await supabase!.from('monthly_prizes').select('*');
        if (error) throw error;
        rawPrizes = data || [];
      } catch {
        rawPrizes = DemoDb.getPrizes();
      }
    }

    // Process each prize to parse footer out of description
    return rawPrizes.map(p => {
      let desc = p.description || '';
      let footer_left = 'Pontuação computada até o final do dia.';
      let footer_right = 'Cada Conversão = +10 pontos';

      if (desc.includes('|||')) {
        const parts = desc.split('|||');
        desc = parts[0];
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          if (part.startsWith('footer_left:')) {
            footer_left = part.replace('footer_left:', '');
          } else if (part.startsWith('footer_right:')) {
            footer_right = part.replace('footer_right:', '');
          }
        }
      }

      return {
        ...p,
        description: desc,
        footer_text_left: footer_left,
        footer_text_right: footer_right
      };
    });
  }

  static async savePrize(data: { 
    id?: string; 
    title: string; 
    description: string; 
    image_path: string | null; 
    sector_id: string | null; 
    reference_month: string; 
    active?: boolean;
    footer_text_left?: string;
    footer_text_right?: string;
  }): Promise<void> {
    const actor = getSessionUser()!;

    let serializedDesc = data.description || '';
    const footerLeft = data.footer_text_left || 'Pontuação computada até o final do dia.';
    const footerRight = data.footer_text_right || 'Cada Conversão = +10 pontos';
    
    serializedDesc += `|||footer_left:${footerLeft}|||footer_right:${footerRight}`;

    const demoPayload = {
      ...data,
      description: serializedDesc
    };

    if (isDemoMode) {
      DemoDb.savePrize(actor, demoPayload);
      return Promise.resolve();
    }

    // Insert or update in monthly_prizes
    const upsertPayload: any = {
      reference_month: data.reference_month,
      sector_id: data.sector_id,
      title: data.title,
      description: serializedDesc,
      image_path: data.image_path,
      active: data.active !== undefined ? data.active : true,
      updated_at: new Date().toISOString()
    };
    if (data.id) {
      upsertPayload.id = data.id;
    }

    const { error } = await supabase!.from('monthly_prizes').upsert(upsertPayload, { onConflict: 'reference_month,sector_id' });

    if (error) throw error;

    await supabase!.from('audit_logs').insert({
      actor_user_id: actor.id,
      action: data.id ? 'edição de prêmio' : 'criação de prêmio',
      entity_type: 'monthly_prizes',
      metadata: { title: data.title, month: data.reference_month, active: data.active }
    });
  }

  // --- RANKING WEIGHTS ---
  static async getWeights(): Promise<Record<string, number>> {
    if (isDemoMode) {
      return Promise.resolve(DemoDb.getRankingWeights());
    }
    try {
      const { data, error } = await supabase!.from('ranking_weights').select('*');
      if (error) throw error;
      const map: Record<string, number> = {};
      data?.forEach(row => {
        map[row.event_type] = row.points;
      });
      return map;
    } catch {
      return DemoDb.getRankingWeights();
    }
  }

  static async updateWeight(key: string, val: number): Promise<void> {
    const actor = getSessionUser()!;
    if (isDemoMode) {
      DemoDb.updateWeights(actor, key, val);
      return Promise.resolve();
    }

    const { error } = await supabase!
      .from('ranking_weights')
      .upsert({ event_type: key, points: val, updated_at: new Date().toISOString() }, { onConflict: 'event_type' });

    if (error) throw error;

    await supabase!.from('audit_logs').insert({
      actor_user_id: actor.id,
      action: 'alteração de pesos do ranking',
      entity_type: 'ranking_weights',
      metadata: { [key]: val }
    });
  }

  // --- ACTIONS/AUDIT LOGS ---
  static async getLogs(): Promise<AuditLog[]> {
    if (isDemoMode) {
      return Promise.resolve(DemoDb.getLogs());
    }
    try {
      // Query profiles to associate name if helpful, or query direct
      const { data, error } = await supabase!
        .from('audit_logs')
        .select(`
          *,
          profiles(full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      return (data || []).map(row => ({
        ...row,
        actor_name: row.profiles ? (row.profiles as any).full_name : 'Hóspede Anônimo / Sistema'
      }));
    } catch {
      return DemoDb.getLogs();
    }
  }

  // --- COMPLAINTS/RECLAMAÇÕES ---
  static async getComplaints(): Promise<Complaint[]> {
    if (isDemoMode) {
      return Promise.resolve(DemoDb.getComplaints());
    }
    try {
      const { data, error } = await supabase!
        .from('complaints')
        .select(`
          *,
          profiles(full_name)
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return (data || []).map(row => ({
        ...row,
        resolver_name: row.profiles ? (row.profiles as any).full_name : null
      }));
    } catch {
      return DemoDb.getComplaints();
    }
  }

  static async updateComplaintStatus(id: string, status: ComplaintStatus, notes?: string): Promise<void> {
    const actor = getSessionUser()!;
    if (isDemoMode) {
      DemoDb.updateComplaintStatus(id, status, notes, actor);
      return Promise.resolve();
    }
    const { error } = await supabase!
      .from('complaints')
      .update({
        status,
        resolution_notes: notes || null,
        resolved_by: actor ? actor.id : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    // Log this action to audit logs
    try {
      await supabase!.from('audit_logs').insert({
        actor_user_id: actor ? actor.id : null,
        action: `resolução de reclamação (${status})`,
        entity_type: 'complaints',
        entity_id: id,
        metadata: { status, notes }
      });
    } catch (e) {
      console.warn("Erro ao salvar log de auditoria de reclamação:", e);
    }
  }
}
