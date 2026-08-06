export type UserRole = 'guest' | 'listener' | 'creator' | 'admin';
export type SignupRole = 'listener' | 'creator';
export type PremiumStatus = 'none' | 'pass' | 'subscribed';
export type ThemePreference = 'system' | 'light' | 'dark';
export type AdminRole = 'super' | 'finance' | 'content' | 'support';
export type CreatorLevel = 'new' | 'rising' | 'verified' | 'elite';
export type SoundStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'archived';
export type PaymentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'need_more_info'
  | 'refunded';
export type PaymentMethod = 'usd_lead_bank' | 'ngn_opay';

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  premium_status: PremiumStatus;
  theme_preference: ThemePreference;
  created_at: string;
  updated_at: string;
};

export type AdminProfile = {
  user_id: string;
  role: AdminRole;
};

export type CreatorProfile = {
  user_id: string;
  bio: string | null;
  level: CreatorLevel;
  is_verified: boolean;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  cover_url?: string | null;
  created_by?: string | null;
};

export type Sound = {
  id: string;
  creator_id: string | null;
  title: string;
  description: string | null;
  cover_url: string | null;
  audio_path: string | null;
  audio_url: string | null;
  duration_seconds: number;
  status: SoundStatus;
  play_count: number;
  favourite_count: number;
  average_rating: number | null;
  rating_count: number;
  is_premium_only: boolean;
  is_featured: boolean;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
};

export type Playlist = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_favourite: boolean;
  created_at: string;
  updated_at: string;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  duration_days: number | null;
  price_usd: number;
  price_ngn: number;
  is_active: boolean;
  sort_order: number;
};

export type PaymentRequest = {
  id: string;
  user_id: string;
  plan_id: string;
  payment_method: PaymentMethod;
  amount: number;
  currency: 'USD' | 'NGN';
  status: PaymentStatus;
  proof_path: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan | null;
};

export type Mix = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};
