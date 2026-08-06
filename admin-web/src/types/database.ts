export type AdminRole = 'super' | 'finance' | 'content' | 'support';

export type AppReleaseStatus = 'coming_soon' | 'available' | 'archived';

export type AppRelease = {
  id: string;
  version: string;
  title: string;
  description: string | null;
  status: AppReleaseStatus;
  apk_path: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AdminListRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  admin_role: AdminRole;
  has_verified_badge?: boolean;
  created_at: string;
};
