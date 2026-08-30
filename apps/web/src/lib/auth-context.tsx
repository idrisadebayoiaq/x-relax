'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { AdminProfile, Profile, SignupRole } from '@/types/database';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  adminProfile: AdminProfile | null;
  loading: boolean;
  isPremium: boolean;
  hasPremiumAccess: boolean;
  hasUnlimitedListening: boolean;
  canUseMixes: boolean;
  canDownloadOffline: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  freeMixLimit: number;
  refreshProfile: () => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    displayName: string;
    role: SignupRole;
    countryCode: string;
    enablePush?: boolean;
  }) => Promise<{ error: string | null }>;
  signIn: (input: { email: string; password: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updateProfile: (input: {
    displayName?: string;
    avatarFile?: File | null;
    bannerFile?: File | null;
    bio?: string | null;
    city?: string | null;
    countryCode?: string | null;
  }) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [freeMixLimit, setFreeMixLimit] = useState(2);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(
    async (user: User | null) => {
      if (!user) {
        setProfile(null);
        setAdminProfile(null);
        setIsPremium(false);
        return;
      }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setProfile((prof as Profile) ?? null);

      const { data: admin } = await supabase
        .from('admin_profiles')
        .select('user_id, role, has_verified_badge')
        .eq('user_id', user.id)
        .maybeSingle();
      const adminRow = (admin as AdminProfile) ?? null;
      setAdminProfile(
        adminRow
          ? {
              ...adminRow,
              has_verified_badge: !!adminRow.has_verified_badge || adminRow.role === 'super',
            }
          : null,
      );

      const { data: premium } = await supabase.rpc('user_has_premium', { uid: user.id });
      setIsPremium(!!premium);

      const { data: flags } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'feature_flags')
        .maybeSingle();
      const limit = Number((flags?.value as { free_mix_track_limit?: number })?.free_mix_track_limit ?? 2);
      setFreeMixLimit(Number.isFinite(limit) ? limit : 2);

      const enabled = (prof as Profile | null)?.push_enabled !== false;
      const { writeLocalPushPref, requestWebPushPermission } = await import('@/lib/web-push');
      writeLocalPushPref(enabled);
      if (enabled) void requestWebPushPermission();
    },
    [supabase],
  );

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    await loadUserData(session.user);
  }, [loadUserData, session?.user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadUserData(data.session?.user ?? null).finally(() => setLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadUserData(nextSession?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase, loadUserData]);

  const signUp = useCallback(
    async ({
      email,
      password,
      displayName,
      role,
      countryCode,
      enablePush = true,
    }: {
      email: string;
      password: string;
      displayName: string;
      role: SignupRole;
      countryCode: string;
      enablePush?: boolean;
    }) => {
      const code = countryCode.trim().toUpperCase();
      if (!code) return { error: 'Country is required' };
      const { writeLocalPushPref, requestWebPushPermission } = await import('@/lib/web-push');
      writeLocalPushPref(enablePush);
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            role: role === 'creator' ? 'creator' : 'listener',
            country_code: code,
            push_enabled: enablePush,
          },
        },
      });
      if (!error) {
        const { error: prefError } = await supabase.rpc('set_push_preference', {
          p_enabled: enablePush,
        });
        if (prefError) console.warn('set_push_preference', prefError.message);
        if (enablePush) void requestWebPushPermission();
      }
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setAdminProfile(null);
    setIsPremium(false);
  }, [supabase]);

  const resetPassword = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const updateProfile = useCallback(
    async (input: {
      displayName?: string;
      avatarFile?: File | null;
      bannerFile?: File | null;
      bio?: string | null;
      city?: string | null;
      countryCode?: string | null;
    }) => {
      if (!session?.user) return { error: 'Not signed in' };

      let avatarUrl: string | undefined;
      if (input.avatarFile) {
        const rawExt = (input.avatarFile.name.split('.').pop() || 'jpg').toLowerCase();
        const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
        const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, input.avatarFile, {
            upsert: true,
            contentType: input.avatarFile.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            cacheControl: '3600',
          });
        if (uploadError) return { error: uploadError.message };
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;
      }

      let bannerUrl: string | undefined;
      if (input.bannerFile) {
        const path = `${session.user.id}/banners/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('covers')
          .upload(path, input.bannerFile, {
            upsert: true,
            contentType: input.bannerFile.type || 'image/jpeg',
            cacheControl: '3600',
          });
        if (uploadError) return { error: uploadError.message };
        const { data: pub } = supabase.storage.from('covers').getPublicUrl(path);
        bannerUrl = `${pub.publicUrl}?v=${Date.now()}`;
      }

      const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
      if (input.displayName != null) patch.display_name = input.displayName.trim();
      if (avatarUrl) patch.avatar_url = avatarUrl;
      if (bannerUrl) patch.banner_url = bannerUrl;
      if (input.bio !== undefined) patch.bio = input.bio?.trim() || null;
      if (input.city !== undefined) patch.city = input.city?.trim() || null;
      if (input.countryCode !== undefined) {
        patch.country_code = input.countryCode
          ? input.countryCode.trim().toUpperCase()
          : null;
      }

      const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
      if (!error && (bannerUrl || input.bio !== undefined)) {
        const creatorPatch: Record<string, string | null> = {
          updated_at: new Date().toISOString(),
        };
        if (bannerUrl) creatorPatch.banner_url = bannerUrl;
        if (input.bio !== undefined) creatorPatch.bio = input.bio?.trim() || null;
        await supabase
          .from('creator_profiles')
          .update(creatorPatch)
          .eq('user_id', session.user.id);
      }
      if (!error) await refreshProfile();
      return { error: error?.message ?? null };
    },
    [supabase, refreshProfile, session?.user],
  );

  const user = session?.user ?? null;
  const isAdmin = profile?.role === 'admin' || !!adminProfile;
  const isCreator = profile?.role === 'creator' || isAdmin;
  const hasPremiumAccess = isPremium || isCreator || isAdmin;
  const hasUnlimitedListening = isPremium || isAdmin;
  const canUseMixes = isPremium || isAdmin;
  const canDownloadOffline = isPremium || isAdmin;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      adminProfile,
      loading,
      isPremium,
      hasPremiumAccess,
      hasUnlimitedListening,
      canUseMixes,
      canDownloadOffline,
      isAdmin,
      isCreator,
      freeMixLimit,
      refreshProfile,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updateProfile,
    }),
    [
      session,
      user,
      profile,
      adminProfile,
      loading,
      isPremium,
      hasPremiumAccess,
      hasUnlimitedListening,
      canUseMixes,
      canDownloadOffline,
      isAdmin,
      isCreator,
      freeMixLimit,
      refreshProfile,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
