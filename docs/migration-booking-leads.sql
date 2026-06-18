-- Booking/HITS leads captured after checkout.
-- Run once in Supabase SQL Editor before using the Booking robot.

CREATE TABLE IF NOT EXISTS public.booking_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_identifier TEXT NOT NULL,
  global_code TEXT,
  guest_name TEXT NOT NULL,
  room_number TEXT,
  stay_start DATE,
  stay_end DATE,
  phone TEXT,
  company TEXT DEFAULT 'BOOKING.COM',
  status TEXT DEFAULT 'Fechado',
  contact_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (contact_status IN ('pending', 'contacted', 'not_contacted')),
  contact_notes TEXT,
  review_converted BOOLEAN NOT NULL DEFAULT false,
  complaint_generated BOOLEAN NOT NULL DEFAULT false,
  contacted_at TIMESTAMPTZ,
  contacted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (folio_identifier)
);

CREATE INDEX IF NOT EXISTS idx_booking_leads_stay_end ON public.booking_leads(stay_end);
CREATE INDEX IF NOT EXISTS idx_booking_leads_guest_name ON public.booking_leads(guest_name);
CREATE INDEX IF NOT EXISTS idx_booking_leads_contact_status ON public.booking_leads(contact_status);
CREATE INDEX IF NOT EXISTS idx_booking_leads_phone ON public.booking_leads(phone);

ALTER TABLE public.booking_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_booking_leads_all_for_admin ON public.booking_leads;
DROP POLICY IF EXISTS policy_booking_leads_select_for_active_profiles ON public.booking_leads;
DROP POLICY IF EXISTS policy_booking_leads_update_for_active_profiles ON public.booking_leads;
DROP POLICY IF EXISTS policy_booking_leads_insert_for_admin ON public.booking_leads;
DROP POLICY IF EXISTS policy_booking_leads_delete_for_admin ON public.booking_leads;

CREATE POLICY policy_booking_leads_select_for_active_profiles
ON public.booking_leads
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.active = true
  )
);

CREATE POLICY policy_booking_leads_update_for_active_profiles
ON public.booking_leads
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.active = true
  )
);

CREATE POLICY policy_booking_leads_insert_for_admin
ON public.booking_leads
FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY policy_booking_leads_delete_for_admin
ON public.booking_leads
FOR DELETE TO authenticated
USING (public.is_admin());
