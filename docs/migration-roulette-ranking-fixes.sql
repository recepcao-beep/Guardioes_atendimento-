-- Fixes for global ranking, platform-based points, and roulette defaults.
-- Run this once in Supabase SQL Editor for an existing production database.

INSERT INTO public.ranking_weights (event_type, points) VALUES
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
