import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  consumePushAsk,
  markPushAskOnNextSync,
  presentWelcomePushIfNeeded,
  syncPushRegistration,
  writeLocalPushPref,
} from '../../lib/push';
import {
  cacheProfileSnapshot,
  clearOfflineUserCache,
  loadCachedProfile,
} from '../../lib/offlineCache';
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
  /** Mix Studio — gated by feature_flags.mixes_require_premium (default true) */
  canUseMixes: boolean;
  /** Offline downloads — premium or admin only */
  canDownloadOffline: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  freeMixLimit: number;
  /** Premium max tracks is 8; free uses freeMixLimit when mixes are unlocked */
  premiumMixLimit: number;
  refreshProfile: () => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    displayName: string;
    role: SignupRole;
    countryCode: string;
    enablePush?: boolean;
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
    bannerUri?: string | null;
    bio?: string | null;
    city?: string | null;
    countryCode?: string | null;
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
  const [mixesRequirePremium, setMixesRequirePremium] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      setAdminProfile(null);
      setIsPremium(false);
      await clearOfflineUserCache();
      return;
    }

    try {
      let nextProfile = await fetchProfile(user.id);
      if (!nextProfile) {
        await new Promise((r) => setTimeout(r, 400));
        nextProfile = await fetchProfile(user.id);
      }

      // Offline / network failure: fall back to last cached profile so the app still opens.
      if (!nextProfile) {
        const cached = await loadCachedProfile();
        if (cached.profile) {
          setProfile(cached.profile);
          setIsPremium(cached.isPremium);
          const enabled = cached.profile.push_enabled !== false;
          void syncPushRegistration({
            ask: consumePushAsk(),
            enabled,
          }).then((result) => {
            if (result.error) console.warn('Push registration:', result.error);
          });
          return;
        }
      }

      setProfile(nextProfile);
      setAdminProfile(await fetchAdminProfile(user.id));

      const { data: premium } = await supabase.rpc('user_has_premium', { uid: user.id });
      setIsPremium(!!premium);
      await cacheProfileSnapshot(nextProfile, !!premium);

      const { data: flags } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'feature_flags')
        .maybeSingle();
      const limit = Number((flags?.value as any)?.free_mix_track_limit ?? 2);
      setFreeMixLimit(Number.isFinite(limit) ? limit : 2);
      const requirePremium = (flags?.value as any)?.mixes_require_premium;
      setMixesRequirePremium(requirePremium !== false);

      const enabled = nextProfile?.push_enabled !== false;
      void syncPushRegistration({
        ask: consumePushAsk(),
        enabled,
      }).then(async (result) => {
        if (result.error) {
          console.warn('Push registration:', result.error);
          await presentWelcomePushIfNeeded();
        }
      });
    } catch (err) {
      console.warn('loadUserData offline fallback', err);
      const cached = await loadCachedProfile();
      if (cached.profile) {
        setProfile(cached.profile);
        setIsPremium(cached.isPremium);
        void syncPushRegistration({
          ask: consumePushAsk(),
          enabled: cached.profile.push_enabled !== false,
        });
      }
    }
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

  // Reload profile when returning from background so avatar_url stays in sync
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      const uid = session?.user?.id;
      if (!uid) return;
      void fetchProfile(uid).then((next) => {
        if (next) setProfile(next);
        void syncPushRegistration({
          ask: false,
          enabled: next?.push_enabled !== false,
        });
      });
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [session?.user?.id]);

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
      const safeRole: SignupRole = role === 'creator' ? 'creator' : 'listener';
      await writeLocalPushPref(enablePush);
      if (enablePush) markPushAskOnNextSync();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            role: safeRole,
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
      }
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
    async (input: {
      displayName?: string;
      avatarUri?: string | null;
      bannerUri?: string | null;
      bio?: string | null;
      city?: string | null;
      countryCode?: string | null;
    }) => {
      if (!session?.user) return { error: 'Not signed in' };

      const readLocalImage = async (uri: string) => {
        let body: ArrayBuffer;
        try {
          const res = await fetch(uri);
          body = await res.arrayBuffer();
          if (!body.byteLength) throw new Error('empty');
        } catch {
          const FileSystem = await import('expo-file-system/legacy');
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const binary = globalThis.atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          body = bytes.buffer;
        }
        return body;
      };

      let avatarUrl: string | undefined;
      if (input.avatarUri) {
        const rawExt = (input.avatarUri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
        const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
        const contentType =
          ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;
        let body: ArrayBuffer;
        try {
          body = await readLocalImage(input.avatarUri);
        } catch {
          return { error: 'Could not read the selected image.' };
        }
        if (!body.byteLength) return { error: 'Could not read the selected image.' };

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, body, { upsert: true, contentType, cacheControl: '3600' });
        if (uploadError) return { error: uploadError.message };

        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;
      }

      let bannerUrl: string | undefined;
      if (input.bannerUri) {
        const path = `${session.user.id}/banners/${Date.now()}.jpg`;
        let body: ArrayBuffer;
        try {
          body = await readLocalImage(input.bannerUri);
        } catch {
          return { error: 'Could not read the banner image.' };
        }
        const { error: uploadError } = await supabase.storage
          .from('covers')
          .upload(path, body, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
        if (uploadError) return { error: uploadError.message };
        const { data: pub } = supabase.storage.from('covers').getPublicUrl(path);
        bannerUrl = `${pub.publicUrl}?v=${Date.now()}`;
      }

      const patch: {
        id?: string;
        display_name?: string;
        avatar_url?: string;
        banner_url?: string;
        bio?: string | null;
        city?: string | null;
        country_code?: string | null;
        updated_at: string;
      } = {
        updated_at: new Date().toISOString(),
      };
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

      let error = (
        await supabase.from('profiles').update(patch).eq('id', session.user.id)
      ).error;

      if (error?.code === 'PGRST116' || error?.message?.includes('0 rows')) {
        const upsert = await supabase.from('profiles').upsert({
          id: session.user.id,
          display_name: patch.display_name ?? session.user.email?.split('@')[0] ?? 'Listener',
          avatar_url: patch.avatar_url ?? null,
          banner_url: patch.banner_url ?? null,
          bio: patch.bio ?? null,
          city: patch.city ?? null,
          country_code: patch.country_code ?? null,
          role: 'listener',
          premium_status: 'none',
          theme_preference: 'system',
          updated_at: patch.updated_at,
        });
        error = upsert.error;
      }

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
  const canUseMixes = mixesRequirePremium ? isPremium || isAdmin : true;
  const canDownloadOffline = isPremium || isAdmin;
  const premiumMixLimit = 8;

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
      premiumMixLimit,
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
      premiumMixLimit,
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
