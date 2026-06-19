/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'guardian';

export interface Sector {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  username: string;
  role: UserRole;
  sector_id: string | null;
  active: boolean;
  must_change_password?: boolean;
  last_login_at?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export type PlatformCode = 'google' | 'booking' | 'tripadvisor' | 'internal';

export interface Platform {
  id: string;
  code: PlatformCode;
  name: string;
  external_url: string;
  whatsapp_message_template: string;
  active: boolean;
  display_order: number;
  color?: string; // Hex or tailwind class
  created_at: string;
  updated_at: string;
}

export type InviteStatus = 
  | 'emitted' 
  | 'opened' 
  | 'internal_completed' 
  | 'externally_verified_manual' 
  | 'externally_reconciled' 
  | 'unattributed' 
  | 'cancelled';

export interface ReviewInvite {
  id: string;
  token: string;
  issuer_user_id: string;
  issuer_sector_id: string | null;
  platform_id: string;
  method: 'qr' | 'whatsapp' | 'assisted';
  guest_phone_masked: string | null;
  status: InviteStatus;
  opened_count: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
  guest_name?: string | null;
  room_number?: string | null;
  platforms?: {
    id?: string | null;
    code?: PlatformCode | string | null;
    name?: string | null;
  } | null;
}

export interface ReviewEvent {
  id: string;
  invite_id: string;
  actor_user_id: string | null;
  event_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface InternalReview {
  id: string;
  invite_id: string;
  score: number; // 1 to 5
  comment: string;
  guest_name?: string;
  room_number?: string;
  guest_email?: string;
  consent_given: boolean;
  created_at: string;
}

export interface ExternalReviewConfirmation {
  id: string;
  invite_id: string;
  platform_id: string;
  confirmation_type: 'manual' | 'reconciled';
  external_review_reference?: string;
  confirmed_by: string; // admin profile id or name
  notes?: string;
  created_at: string;
}

export interface MonthlyPrize {
  id: string;
  reference_month: string; // YYYY-MM
  sector_id: string | null; // Null means general prize
  title: string;
  description: string;
  image_path: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  footer_text_left?: string;
  footer_text_right?: string;
}

export interface RankingWeights {
  id: string;
  event_type: string;
  points: number;
  updated_at: string;
}

export interface AppSettings {
  key: string;
  value: Record<string, any>;
  updated_at: string;
}

export interface RouletteOption {
  id: string;
  label: string;
  active: boolean;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  actor_name?: string; // display purpose
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved';

export interface Complaint {
  id: string;
  invite_id: string | null;
  guest_name: string;
  room_number: string;
  description: string;
  status: ComplaintStatus;
  resolved_by?: string | null;
  resolver_name?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type BookingContactStatus = 'pending' | 'contacted' | 'not_contacted';

export interface BookingLead {
  id: string;
  folio_identifier: string;
  global_code?: string | null;
  guest_name: string;
  room_number: string | null;
  stay_start: string | null;
  stay_end: string | null;
  phone: string | null;
  company?: string | null;
  status?: string | null;
  contact_status: BookingContactStatus;
  contact_notes?: string | null;
  review_converted?: boolean;
  complaint_generated?: boolean;
  contacted_at?: string | null;
  contacted_by?: string | null;
  created_at: string;
  updated_at: string;
}
