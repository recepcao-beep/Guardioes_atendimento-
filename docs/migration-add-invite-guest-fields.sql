-- Add guest identification fields required by QR reconciliation robot.
-- Safe to run more than once.

ALTER TABLE public.review_invites
  ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS room_number VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_invites_guest_name
  ON public.review_invites (guest_name);

CREATE INDEX IF NOT EXISTS idx_invites_room_number
  ON public.review_invites (room_number);
