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
import { supabase } from '../../lib/supabase';
import { presentWelcomePushIfNeeded, registerForPushNotifications } from '../../lib/push';
import type { AdminProfile, Profile, SignupRole } from '../../types/database';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  adminProfile: AdminProfile | null;
  loading: boolean;
  isPremium: boolean;
  /** Premium features (downloads, mix save) — includes creator/admin perks */
  hasPremiumAccess: boolean;
  /** Unlimited daily listening (premium, creator, admin) */
  hasUnlimitedListening: boolean;
  /** Mix Studio — premium or admin only */
  canUseMixes: boolean;
  /** Offline downloads — premium or admin only */
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
  }) => Promise<{ error: string | null }>;
  signIn: (input: {
    email: string;
    password: string;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updateDisplayName: (displayName: string) => Promise<{ error: string | null }>;
  updateProfile: (input: {
    displayName?: string;
    avatarUri?: string | null;
  }) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Failed to load profile', error.message);
    return null;
  }
  return data as Profile | null;
}

async function fetchAdminProfile(userId: string): Promise<AdminProfile | null> {
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('user_id, role, has_verified_badge')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null;
  const row = data as AdminProfile | null;
  if (!row) return null;
  return {
    ...row,
    has_verified_badge: !!row.has_verified_badge || row.role === 'super',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [freeMixLimit, setFreeMixLimit] = useState(2);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      setAdminProfile(null);
      setIsPremium(false);
      return;
    }

    let nextProfile = await fetchProfile(user.id);
    if (!nextProfile) {
      await new Promise((r) => setTimeout(r, 400));
      nextProfile = await fetchProfile(user.id);
    }
    setProfile(nextProfile);
    setAdminProfile(await fetchAdminProfile(user.id));

    const { data: premium } = await supabase.rpc('user_has_premium', { uid: user.id });
    setIsPremium(!!premium);

    const { data: flags } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'feature_flags')
      .maybeSingle();
    const limit = Number((flags?.value as any)?.free_mix_track_limit ?? 2);
    setFreeMixLimit(Number.isFinite(limit) ? limit : 2);

    // Best-effort FCM/APNs registration + welcome system notification
    registerForPushNotifications().then(async (result) => {
      if (result.error) {
        console.warn('Push registration:', result.error);
        await presentWelcomePushIfNeeded();
      }
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    await loadUserData(session.user);
  }, [loadUserData, session?.user]);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        return loadUserData(data.session?.user ?? null);
      })
      .catch((err) => {
        console.warn('getSession failed', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadUserData(nextSession?.user ?? null).catch((err) =>
        console.warn('auth state load failed', err),
      );
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const signUp = useCallback(
    async ({
      email,
      password,
      displayName,
      role,
    }: {
      email: string;
      password: string;
      displayName: string;
      role: SignupRole;
    }) => {
      const safeRole: SignupRole = role === 'creator' ? 'creator' : 'listener';
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            role: safeRole,
          },
        },
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setAdminProfile(null);
    setIsPremium(false);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return { error: error?.message ?? null };
  }, []);

  const updateProfile = useCallback(
    async (input: { displayName?: string; avatarUri?: string | null }) => {
      if (!session?.user) return { error: 'Not signed in' };

      let avatarUrl: string | undefined;
      if (input.avatarUri) {
        const ext = input.avatarUri.split('.').pop()?.split('?')[0] || 'jpg';
        const path = `${session.user.id}/avatar.${ext}`;
        const res = await fetch(input.avatarUri);
        const blob = await res.blob();
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
        if (uploadError) return { error: uploadError.message };
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = pub.publicUrl;
      }

      const patch: {
        id?: string;
        display_name?: string;
        avatar_url?: string;
        updated_at: string;
      } = {
        updated_at: new Date().toISOString(),
      };
      if (input.displayName != null) patch.display_name = input.displayName.trim();
      if (avatarUrl) patch.avatar_url = avatarUrl;

      let error = (
        await supabase.from('profiles').update(patch).eq('id', session.user.id)
      ).error;

      if (error?.code === 'PGRST116' || error?.message?.includes('0 rows')) {
        const upsert = await supabase.from('profiles').upsert({
          id: session.user.id,
          display_name: patch.display_name ?? session.user.email?.split('@')[0] ?? 'Listener',
          avatar_url: patch.avatar_url ?? null,
          role: 'listener',
          premium_status: 'none',
          theme_preference: 'system',
          updated_at: patch.updated_at,
        });
        error = upsert.error;
      }

      if (!error) await refreshProfile();
      return { error: error?.message ?? null };
    },
    [refreshProfile, session?.user],
  );

  const updateDisplayName = useCallback(
    async (displayName: string) => updateProfile({ displayName }),
    [updateProfile],
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
      updateDisplayName,
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
      updateDisplayName,
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
