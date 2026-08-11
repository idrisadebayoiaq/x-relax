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
  banner_url?: string | null;
  bio?: string | null;
  city?: string | null;
  country_code: string | null;
  role: UserRole;
  premium_status: PremiumStatus;
  theme_preference: ThemePreference;
  created_at: string;
  updated_at: string;
};

export type AdminProfile = {
  user_id: string;
  role: AdminRole;
  has_verified_badge?: boolean;
};

export type CreatorProfile = {
  user_id: string;
  bio: string | null;
  level: CreatorLevel;
  is_verified: boolean;
  can_earn?: boolean;
  has_blue_badge?: boolean;
  banner_url?: string | null;
  monthly_listeners?: number;
  follower_count?: number;
  display_name?: string | null;
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
  visibility?: 'private' | 'public';
  cover_url?: string | null;
  item_count?: number;
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
  duration_seconds?: number | null;
  sound_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type AppReleaseStatus = 'coming_soon' | 'available' | 'archived';

export type AppRelease = {
  id: string;
  version: string;
  title: string;
  description: string | null;
  status: AppReleaseStatus;
  apk_path: string | null;
  download_url?: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
