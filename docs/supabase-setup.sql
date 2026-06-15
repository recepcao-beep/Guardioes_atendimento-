-- =========================================================================
-- SETUP COMPLETO DE BANCO DE DADOS - PORTAL DE AVALIAÇÕES DO HOTEL (IDEMPOTENTE)
-- Localização sugerida: docs/supabase-setup.sql
-- =========================================================================

-- =========================================================================
-- 1. LIMPEZA PREVENTIVA DE BANCO DE DADOS (Zera todas as tabelas em ordem)
-- =========================================================================

-- Remove políticas anteriores
DROP POLICY IF EXISTS policy_sectors_all_for_admin ON public.sectors;
DROP POLICY IF EXISTS policy_sectors_select_for_guardians ON public.sectors;
DROP POLICY IF EXISTS policy_profiles_all_for_admin ON public.profiles;
DROP POLICY IF EXISTS policy_profiles_select_self ON public.profiles;
DROP POLICY IF EXISTS policy_platforms_all_for_admin ON public.platforms;
DROP POLICY IF EXISTS policy_platforms_select_activated ON public.platforms;
DROP POLICY IF EXISTS policy_invites_all_for_admin ON public.review_invites;
DROP POLICY IF EXISTS policy_invites_insert_for_guardians ON public.review_invites;
DROP POLICY IF EXISTS policy_invites_select_own ON public.review_invites;
DROP POLICY IF EXISTS policy_events_all_for_admin ON public.review_events;
DROP POLICY IF EXISTS policy_events_insert_for_guardians ON public.review_events;
DROP POLICY IF EXISTS policy_internal_reviews_all_for_admin ON public.internal_reviews;
DROP POLICY IF EXISTS policy_internal_reviews_insert_public ON public.internal_reviews;
DROP POLICY IF EXISTS policy_confirmations_all_for_admin ON public.external_review_confirmations;
DROP POLICY IF EXISTS policy_confirmations_select_for_guardians ON public.external_review_confirmations;
DROP POLICY IF EXISTS policy_prizes_all_for_admin ON public.monthly_prizes;
DROP POLICY IF EXISTS policy_prizes_select_all ON public.monthly_prizes;
DROP POLICY IF EXISTS policy_weights_all_for_admin ON public.ranking_weights;
DROP POLICY IF EXISTS policy_weights_select_for_guardians ON public.ranking_weights;
DROP POLICY IF EXISTS policy_app_settings_all_for_admin ON public.app_settings;
DROP POLICY IF EXISTS policy_audit_logs_all_for_admin ON public.audit_logs;

-- Remove triggers anteriores
DROP TRIGGER IF EXISTS update_sectors_modtime ON public.sectors;
DROP TRIGGER IF EXISTS update_profiles_modtime ON public.profiles;
DROP TRIGGER IF EXISTS update_platforms_modtime ON public.platforms;
DROP TRIGGER IF EXISTS update_review_invites_modtime ON public.review_invites;
DROP TRIGGER IF EXISTS update_monthly_prizes_modtime ON public.monthly_prizes;

-- Drop de tabelas com cascade para evitar pendências de chaves estrangeiras
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.app_settings CASCADE;
DROP TABLE IF EXISTS public.ranking_weights CASCADE;
DROP TABLE IF EXISTS public.monthly_prizes CASCADE;
DROP TABLE IF EXISTS public.external_review_confirmations CASCADE;
DROP TABLE IF EXISTS public.internal_reviews CASCADE;
DROP TABLE IF EXISTS public.review_events CASCADE;
DROP TABLE IF EXISTS public.review_invites CASCADE;
DROP TABLE IF EXISTS public.platforms CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.sectors CASCADE;

-- Drop de enums customizados se existirem
DROP TYPE IF EXISTS public.invite_status;
DROP TYPE IF EXISTS public.platform_code;
DROP TYPE IF EXISTS public.user_role;

-- Instala as extensões essenciais no schema extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- =========================================================================
-- 2. CRIAÇÃO DAS TABELAS DO SISTEMA
-- =========================================================================

-- 1. TABELA DE SETORES (sectors)
CREATE TABLE public.sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tipo de função de usuário
CREATE TYPE public.user_role AS ENUM ('admin', 'guardian');

-- 2. TABELA DE PERFIS DE USUÁRIOS (profiles)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(150) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  role public.user_role NOT NULL DEFAULT 'guardian',
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  avatar_url TEXT,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Observação de Sincronização: A criação de triggers e alteração de tabelas no schema auth (como auth.users)
-- está restrita em sistemas Supabase modernos para evitar loops recursivos de segurança e erros 42501 (must be owner of table users).
-- Por conta disso, toda sincronização de cadastro e inserções síncronas de public.profiles correspondentes
-- ocorrem de forma 100% segura diretamente pelo cliente da API Front-End no arquivo "src/lib/api.ts".

-- Tipo código de plataforma
CREATE TYPE public.platform_code AS ENUM ('google', 'booking', 'tripadvisor', 'internal');

-- 3. TABELA DE PLATAFORMAS (platforms)
CREATE TABLE public.platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code public.platform_code UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  external_url TEXT NOT NULL,
  whatsapp_message_template TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  color VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tipo status de convidado/convite
CREATE TYPE public.invite_status AS ENUM (
  'emitted', 
  'opened', 
  'internal_completed', 
  'externally_verified_manual', 
  'externally_reconciled', 
  'unattributed', 
  'cancelled'
);

-- 4. TABELA DE CONVITES (review_invites)
CREATE TABLE public.review_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(100) UNIQUE NOT NULL,
  issuer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issuer_sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL CHECK (method IN ('qr', 'whatsapp', 'assisted')),
  guest_phone_masked VARCHAR(50),
  guest_name VARCHAR(150),
  room_number VARCHAR(20),
  status public.invite_status NOT NULL DEFAULT 'emitted',
  opened_count INT NOT NULL DEFAULT 0,
  first_opened_at TIMESTAMP WITH TIME ZONE,
  last_opened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. TABELA DE EVENTOS (review_events)
CREATE TABLE public.review_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invite_id UUID REFERENCES public.review_invites(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL, -- e.g. 'invite_created', 'redirect_opened', etc.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. TABELA DE AVALIAÇÕES INTERNAS (internal_reviews)
CREATE TABLE public.internal_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invite_id UUID UNIQUE NOT NULL REFERENCES public.review_invites(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT,
  guest_name VARCHAR(150),
  room_number VARCHAR(20),
  guest_email VARCHAR(200),
  consent_given BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. TABELA DE CONFIRMAÇÕES EXTERNAS (external_review_confirmations)
CREATE TABLE public.external_review_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invite_id UUID UNIQUE NOT NULL REFERENCES public.review_invites(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  confirmation_type VARCHAR(30) NOT NULL CHECK (confirmation_type IN ('manual', 'reconciled')),
  external_review_reference VARCHAR(200),
  confirmed_by VARCHAR(150) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. TABELA DE PRÊMIOS DO MÊS (monthly_prizes)
CREATE TABLE public.monthly_prizes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_month VARCHAR(7) NOT NULL, -- formato 'YYYY-MM'
  sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE, -- opcional, se for por setor
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  image_path TEXT, -- URL do storage
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_month_sector UNIQUE (reference_month, sector_id)
);

-- 9. TABELA DE PESOS PARA PONTUAÇÃO (ranking_weights)
CREATE TABLE public.ranking_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) UNIQUE NOT NULL,
  points INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. CONFIGURAÇÕES ADICIONAIS DO SISTEMA (app_settings)
CREATE TABLE public.app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11. REGISTROS DE AUDITORIA (audit_logs)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 12. TABELA DE RECLAMAÇÕES / OCORRÊNCIAS (complaints)
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invite_id UUID REFERENCES public.review_invites(id) ON DELETE SET NULL,
  guest_name VARCHAR(150) NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =========================================================================
-- 3. CRIAÇÃO DE ÍNDICES DE DESEMPENHO
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.review_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_issuer_user_id ON public.review_invites(issuer_user_id);
CREATE INDEX IF NOT EXISTS idx_invites_issuer_sector_id ON public.review_invites(issuer_sector_id);
CREATE INDEX IF NOT EXISTS idx_invites_platform_id ON public.review_invites(platform_id);
CREATE INDEX IF NOT EXISTS idx_invites_status ON public.review_invites(status);
CREATE INDEX IF NOT EXISTS idx_invites_created_at ON public.review_invites(created_at);
CREATE INDEX IF NOT EXISTS idx_events_invite_id ON public.review_events(invite_id);
CREATE INDEX IF NOT EXISTS idx_internal_reviews_invite_id ON public.internal_reviews(invite_id);

-- =========================================================================
-- 4. TRIGGERS E FUNÇÕES DE MODIFICAÇÃO (updated_at)
-- =========================================================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sectors_modtime BEFORE UPDATE ON public.sectors FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_platforms_modtime BEFORE UPDATE ON public.platforms FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_review_invites_modtime BEFORE UPDATE ON public.review_invites FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_monthly_prizes_modtime BEFORE UPDATE ON public.monthly_prizes FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_complaints_modtime BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- =========================================================================
-- 5. PROCEDIMENTOS DE SEGURANÇA E HELPERS DA API (Bypass RLS para o Admin)
-- =========================================================================

-- PROCEDIMENTO SEGURO PARA VERIFICAÇÃO DE LOGIN ADMINISTRATIVO SEGURO
CREATE OR REPLACE FUNCTION public.login_admin_secure(password_field TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pass TEXT;
  admin_user JSONB;
  admin_id UUID;
BEGIN
  -- Busca senha do admin no app_settings
  SELECT (value->>'password') INTO stored_pass 
  FROM public.app_settings 
  WHERE key = 'admin_password_secret';

  -- Fallback para senha padrão se não existir
  IF stored_pass IS NULL THEN
    stored_pass := '0000';
  END IF;

  -- Se a senha bater
  IF password_field = stored_pass THEN
    -- Achar o perfil do admin
    SELECT id INTO admin_id FROM public.profiles WHERE role = 'admin' AND username = 'admin' LIMIT 1;
    
    -- Atualizacao do ultimo login do admin
    UPDATE public.profiles 
    SET last_login_at = now(),
        must_change_password = (stored_pass = '0000')
    WHERE id = admin_id;

    -- Registrar auditoria
    INSERT INTO public.audit_logs (actor_user_id, action, entity_type, metadata)
    VALUES (admin_id, 'login', 'auth', '{"role": "admin"}'::jsonb);

    SELECT jsonb_build_object(
      'id', id,
      'full_name', full_name,
      'username', username,
      'role', role,
      'sector_id', sector_id,
      'must_change_password', (stored_pass = '0000')
    ) INTO admin_user 
    FROM public.profiles 
    WHERE id = admin_id;

    RETURN jsonb_build_object('user', admin_user, 'success', true);
  ELSE
    RETURN jsonb_build_object('user', null, 'success', false);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- PROCEDIMENTO SEGURO PARA CRIAR UM NOVO GUARDIÃO (Bypass RLS)
CREATE OR REPLACE FUNCTION public.create_guardian_profile_secure(
  new_id UUID,
  f_name TEXT,
  u_name TEXT,
  s_id UUID,
  act BOOLEAN,
  must_change BOOLEAN
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile JSONB;
BEGIN
  INSERT INTO public.profiles (id, full_name, username, role, sector_id, active, must_change_password)
  VALUES (new_id, f_name, u_name, 'guardian', s_id, act, must_change)
  RETURNING jsonb_build_object(
    'id', id,
    'full_name', full_name,
    'username', username,
    'role', role,
    'sector_id', sector_id,
    'active', active,
    'must_change_password', must_change_password,
    'created_at', created_at
  ) INTO new_profile;

  RETURN jsonb_build_object('profile', new_profile, 'success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- PROCEDIMENTO SEGURO PARA ATUALIZAR UM GUARDIÃO (Bypass RLS)
CREATE OR REPLACE FUNCTION public.update_guardian_profile_secure(
  target_id UUID,
  f_name TEXT DEFAULT NULL,
  u_name TEXT DEFAULT NULL,
  s_id UUID DEFAULT NULL,
  act BOOLEAN DEFAULT NULL,
  must_change BOOLEAN DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_profile JSONB;
BEGIN
  UPDATE public.profiles
  SET 
    full_name = COALESCE(f_name, full_name),
    username = COALESCE(u_name, username),
    sector_id = COALESCE(s_id, sector_id),
    active = COALESCE(act, active),
    must_change_password = COALESCE(must_change, must_change_password),
    updated_at = now()
  WHERE id = target_id
  RETURNING jsonb_build_object(
    'id', id,
    'full_name', full_name,
    'username', username,
    'role', role,
    'sector_id', sector_id,
    'active', active,
    'must_change_password', must_change_password,
    'updated_at', updated_at
  ) INTO updated_profile;

  IF updated_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado.');
  END IF;

  RETURN jsonb_build_object('profile', updated_profile, 'success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- PROCEDIMENTO SEGURO PARA ATUALIZAR A SENHA ADMINISTRATIVA (E SINCRONIZAR COM O SUPABASE AUTH)
CREATE OR REPLACE FUNCTION public.update_admin_password_secure(
  old_password TEXT,
  new_password TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pass TEXT;
BEGIN
  -- Busca senha atual do admin no app_settings
  SELECT (value->>'password') INTO stored_pass 
  FROM public.app_settings 
  WHERE key = 'admin_password_secret';

  IF stored_pass IS NULL THEN
    stored_pass := '0000';
  END IF;

  IF old_password <> stored_pass THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha atual informada está incorreta.');
  END IF;

  -- Grava/Upsert nova senha nas configurações locais
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('admin_password_secret', jsonb_build_object('password', new_password), now())
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('password', new_password),
      updated_at = now();

  -- Nota: O alinhamento de senha do GoTrue e atualização na camada nativa
  -- é feito diretamente pela nossa API client-side no front-end para evitar manipulação direta do schema auth.

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- PROCEDIMENTO SEGURO PARA GARANTIR EXISTÊNCIA SÍNCRONA DO SUPABASE AUTH DO ADMIN
CREATE OR REPLACE FUNCTION public.ensure_admin_auth_user(password_field TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pass TEXT;
BEGIN
  -- 1. Busca a senha atual do admin no app_settings para verificação de seguranca
  SELECT (value->>'password') INTO stored_pass 
  FROM public.app_settings 
  WHERE key = 'admin_password_secret';

  IF stored_pass IS NULL THEN
    stored_pass := '0000';
  END IF;

  -- Se a senha fornecida nao for correta, barra a operacao
  IF password_field <> stored_pass THEN
    RETURN false;
  END IF;

  -- 2. Garante que seu correspondente em public.profiles esteja integro e ativo.
  -- Usamos o ID UUID constante do Super Admin: 'e71f9cfd-114c-4e89-9a74-d022b7a0d0d0'
  INSERT INTO public.profiles (id, full_name, username, role, sector_id, active, must_change_password)
  VALUES (
    'e71f9cfd-114c-4e89-9a74-d022b7a0d0d0',
    'Super Admin',
    'admin',
    'admin',
    NULL,
    true,
    (stored_pass = '0000')
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = 'Super Admin',
      username = 'admin',
      role = 'admin',
      active = true,
      must_change_password = EXCLUDED.must_change_password;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 6. POLÍTICAS DE SEGURANÇA (RLS - Row Level Security)
-- =========================================================================
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_review_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Função utilitária para verificar se usuário autenticado é admin (livre de recursão de RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- 1. Atalho rápido usando JWT para máxima performance (evita bater no banco em chamadas de API)
  IF auth.jwt() ->> 'email' = 'admin@hotelreviews.internal' OR 
     auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' THEN
    RETURN true;
  END IF;

  -- 2. Busca direta e segura na tabela auth.users (que não possui RLS) para evitar loops e recursões
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
      AND (email = 'admin@hotelreviews.internal' OR raw_user_meta_data ->> 'role' = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Políticas de Sectors
CREATE POLICY policy_sectors_all_for_admin ON public.sectors FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY policy_sectors_select_for_guardians ON public.sectors FOR SELECT TO authenticated USING (active = true);

-- 2. Políticas de Profiles
CREATE POLICY policy_profiles_all_for_admin ON public.profiles FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY policy_profiles_select_self ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

-- 3. Políticas de Platforms
CREATE POLICY policy_platforms_all_for_admin ON public.platforms FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY policy_platforms_select_activated ON public.platforms FOR SELECT TO authenticated USING (active = true);

-- 4. Políticas de Review Invites
CREATE POLICY policy_invites_all_for_admin ON public.review_invites FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY policy_invites_insert_for_guardians ON public.review_invites FOR INSERT TO authenticated 
WITH CHECK (
  auth.uid() = issuer_user_id 
  AND NOT public.is_admin()
);
CREATE POLICY policy_invites_select_own ON public.review_invites FOR SELECT TO authenticated USING (
  auth.uid() = issuer_user_id
);

-- 5. Políticas de Review Events
CREATE POLICY policy_events_all_for_admin ON public.review_events FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY policy_events_insert_for_guardians ON public.review_events FOR INSERT TO authenticated WITH CHECK (
  actor_user_id = auth.uid()
);

-- 6. Políticas de Internal Reviews (Formulários)
CREATE POLICY policy_internal_reviews_all_for_admin ON public.internal_reviews FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY policy_internal_reviews_insert_public ON public.internal_reviews FOR INSERT TO anon WITH CHECK (true);

-- 7. Políticas de CONFIRMAÇÕES EXTERNAS
CREATE POLICY policy_confirmations_all_for_admin ON public.external_review_confirmations FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY policy_confirmations_select_for_guardians ON public.external_review_confirmations FOR SELECT TO authenticated USING (
  invite_id IN (SELECT id FROM public.review_invites WHERE issuer_user_id = auth.uid())
);

-- 8. Políticas de Prêmios do Mês
CREATE POLICY policy_prizes_all_for_admin ON public.monthly_prizes FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY policy_prizes_select_all ON public.monthly_prizes FOR SELECT TO authenticated USING (active = true);

-- 9. Políticas de Pesos do Ranking
CREATE POLICY policy_weights_all_for_admin ON public.ranking_weights FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY policy_weights_select_for_guardians ON public.ranking_weights FOR SELECT TO authenticated USING (true);

-- 10. Políticas de App Settings
CREATE POLICY policy_app_settings_all_for_admin ON public.app_settings FOR ALL TO authenticated USING (public.is_admin());

-- 11. Políticas de Logs de Auditoria
CREATE POLICY policy_audit_logs_all_for_admin ON public.audit_logs FOR ALL TO authenticated USING (public.is_admin());

-- 12. Políticas de Reclamações (complaints)
CREATE POLICY policy_complaints_all_for_admin ON public.complaints FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY policy_complaints_insert_for_guardians ON public.complaints FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY policy_complaints_select_for_guardians ON public.complaints FOR SELECT TO authenticated USING (true);


-- =========================================================================
-- 7. ESTADOS DO SISTEMA E SEEDING
-- =========================================================================

-- Limpa qualquer conta administrativa corrompida ou legado para purgar o GoTrue de chaves quebradas
DELETE FROM auth.users WHERE email = 'admin@hotelreviews.internal';
DELETE FROM auth.identities WHERE provider_id = 'e71f9cfd-114c-4e89-9a74-d022b7a0d0d0' OR provider_id = 'admin@hotelreviews.internal';

-- Grava a senha padrão do Admin no app_settings para checagem secundária opcional
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('admin_password_secret', jsonb_build_object('password', '0000'), now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Carga inicial de Setores de Exemplo
INSERT INTO public.sectors (id, name, active) VALUES
('b08db9eb-de03-4fe6-991f-0b9f5835ea51', 'Recepção', true),
('f19f1938-f7b6-4dfc-aba8-16e53a39f603', 'Governança', true),
('282f9d64-e692-4f05-8857-e9a80be35722', 'Restaurante', true),
('918d3cfb-a010-449e-b86e-b3deecf4b111', 'Reservas', true)
ON CONFLICT (name) DO NOTHING;

-- Carga inicial de Plataformas Ativas
INSERT INTO public.platforms (code, name, external_url, whatsapp_message_template, active, display_order, color) VALUES
('google', 'Google Avaliações', 'https://search.google.com/local/writereview?placeid=ChIJ8SF6uFdfzSgRy8UjPyl9gQ8', 'Olá! Agradecemos por se hospedar conosco. Sua opinião vale ouro. Poderia deixar uma rápida avaliação no Google? Acesse: {link}', true, 1, '#4285F4'),
('booking', 'Booking.com', 'https://www.booking.com/reviews.html', 'Prezado hóspede, ficamos contentes com sua estadia. Relate sua experiência com nosso hotel no Booking.com em: {link}', true, 2, '#003580'),
('tripadvisor', 'Tripadvisor', 'https://www.tripadvisor.com.br/UserReview-g303604-d306000-Hotel_Royale.html', 'Sua estadia no Hotel Royale foi enriquecedora? Compartilhe com outros viajantes no Tripadvisor usando o link: {link}', true, 3, '#34E0A1'),
('internal', 'Pesquisa Interna (NPS)', '/avaliacao-interna/', 'Gostamos de lhe ouvir! Preencha nossa breve avaliação interna para que possamos aprimorar cada atendimento: {link}', true, 4, '#D4AF37')
ON CONFLICT (code) DO NOTHING;

-- Carga inicial de Pesos de Metas do Ranking
INSERT INTO public.ranking_weights (event_type, points) VALUES
('qr_generated', 0),
('whatsapp_generated', 0),
('link_opened', 0),
('internal_review_completed', 10),
('external_review_confirmed', 10),
('external_review_reconciled', 10),
('platform_booking', 5),
('platform_tripadvisor', 3),
('platform_google', 2),
('platform_internal', 1)
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO public.app_settings (key, value, updated_at) VALUES
(
  'roulette_options',
  jsonb_build_object(
    'options',
    jsonb_build_array(
      jsonb_build_object('id', 'late-check-out', 'label', 'Late check out', 'active', true),
      jsonb_build_object('id', 'espumante', 'label', 'Espumante', 'active', true),
      jsonb_build_object('id', 'mesa-found', 'label', 'Mesa de found', 'active', true),
      jsonb_build_object('id', 'cafe-1kg', 'label', '1kg de café', 'active', true),
      jsonb_build_object('id', 'nada', 'label', 'Nada', 'active', true)
    )
  ),
  NOW()
)
ON CONFLICT (key) DO NOTHING;
