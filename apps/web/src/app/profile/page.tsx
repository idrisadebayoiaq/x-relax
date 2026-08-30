'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Camera,
  ChevronRight,
  FileText,
  Gem,
  Heart,
  LogOut,
  Mic,
  Music2,
  Settings2,
  Share2,
  Shield,
  ShieldCheck,
  ArrowDownCircle,
  Clock3,
} from 'lucide-react';
import { CoverArt } from '@/components/CoverArt';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { COUNTRIES } from '@/lib/countries';
import { appAlert, appConfirm } from '@/components/AppDialog';


const ACCENT = 'var(--accent)';
const ACCENT_SOFT = 'var(--accent-soft)';

type ProfileStats = {
  soundsSaved: number;
  favourites: number;
  downloads: number;
  listeningHours: number;
};

export default function ProfilePage() {
  const {
    profile,
    user,
    isPremium,
    isAdmin,
    isCreator,
    canDownloadOffline,
    adminProfile,
    updateProfile,
    signOut,
    refreshProfile,
  } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [countryCode, setCountryCode] = useState(profile?.country_code ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [apkUrl, setApkUrl] = useState('');
  const [isVerifiedCreator, setIsVerifiedCreator] = useState(false);
  const [stats, setStats] = useState<ProfileStats>({
    soundsSaved: 0,
    favourites: 0,
    downloads: 0,
    listeningHours: 0,
  });

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
    setCountryCode(profile?.country_code ?? '');
    setBio(profile?.bio ?? '');
    setCity(profile?.city ?? '');
  }, [profile?.display_name, profile?.country_code, profile?.bio, profile?.city]);

  useEffect(() => {
    createClient()
      .from('app_releases')
      .select('download_url, apk_path, status')
      .neq('status', 'archived')
      .order('sort_order', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0] as { download_url?: string | null; apk_path?: string | null } | undefined;
        const url = row?.download_url || row?.apk_path || '';
        if (url) setApkUrl(url);
      });
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!user || !isCreator) {
      setIsVerifiedCreator(false);
      return;
    }
    createClient()
      .from('creator_profiles')
      .select('can_earn, is_verified')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsVerifiedCreator(!!data?.can_earn || !!data?.is_verified);
      });
  }, [user?.id, isCreator]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      supabase
        .from('favourites')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      canDownloadOffline
        ? supabase
            .from('downloads')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
        : Promise.resolve({ count: 0 }),
      supabase.from('playlists').select('id, items:playlist_items(id)').eq('user_id', user.id),
      supabase
        .from('listening_history')
        .select('progress_seconds')
        .eq('user_id', user.id)
        .limit(500),
    ]).then(([{ count: favCount }, { count: dlCount }, { data: playlists }, { data: history }]) => {
      const saved = ((playlists as { items?: { id: string }[] }[]) ?? []).reduce(
        (sum, pl) => sum + (pl.items?.length ?? 0),
        0,
      );
      const seconds = ((history as { progress_seconds?: number }[]) ?? []).reduce(
        (sum, row) => sum + Number(row.progress_seconds ?? 0),
        0,
      );
      setStats({
        soundsSaved: saved,
        favourites: Number(favCount ?? 0),
        downloads: Number(dlCount ?? 0),
        listeningHours: Math.max(0, Math.round(seconds / 3600)),
      });
    });
  }, [user?.id, canDownloadOffline]);

  const showBlueBadge =
    (isCreator || isAdmin) &&
    (isVerifiedCreator || !!adminProfile?.has_verified_badge || adminProfile?.role === 'super');
  const showWhiteBadge = !isCreator && !isAdmin && isPremium;
  const premiumActive = isPremium;
  const roleLabel =
    profile?.role === 'admin'
      ? 'Admin'
      : profile?.role === 'creator'
        ? 'Creator'
        : 'Listener';

  const onFile = (file: File | null) => {
    setAvatarFile(file);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  };

  const save = async () => {
    if (!countryCode) {
      appAlert('Please select your country.');
      return;
    }
    setBusy(true);
    const { error } = await updateProfile({
      displayName,
      avatarFile,
      bannerFile,
      bio,
      city,
      countryCode,
    });
    setBusy(false);
    if (error) {
      appAlert(error);
      return;
    }
    setAvatarFile(null);
    setBannerFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setAvatarPreview(null);
    setBannerPreview(null);
    setEditOpen(false);
  };

  const avatarUri = avatarPreview ?? profile?.avatar_url ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-serif font-bold tracking-tight">Profile</h1>
          <p className="text-muted mt-1">Manage your account, sounds, and preferences.</p>
        </div>
        <button
          type="button"
          className="h-10 w-10 rounded-xl border border-border flex items-center justify-center hover:bg-surface"
          onClick={() => setEditOpen(true)}
          aria-label="Edit profile"
        >
          <Settings2 size={18} />
        </button>
      </div>

      <div className="flex flex-col items-center text-center gap-3 py-2">
        <button type="button" className="relative" onClick={() => fileRef.current?.click()}>
          <div
            className="rounded-full p-[3px]"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, var(--brand), ${ACCENT})`,
            }}
          >
            <div className="rounded-full bg-background p-0.5">
              {avatarUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUri}
                  alt=""
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <CoverArt
                  title={profile?.display_name ?? 'You'}
                  uri={null}
                  size={96}
                  rounded={48}
                />
              )}
            </div>
          </div>
          <span className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center border-2 border-background">
            <Camera size={14} />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null);
            setEditOpen(true);
          }}
        />

        <div className="flex items-center gap-2">
          <p className="text-2xl font-serif font-semibold">
            {profile?.display_name ?? 'Listener'}
          </p>
          {showWhiteBadge ? <VerifiedBadge tone="white" size={18} /> : null}
          {showBlueBadge ? <VerifiedBadge tone="blue" size={18} /> : null}
        </div>
        <p className="text-sm text-muted">
          {[profile?.city, profile?.country_code].filter(Boolean).join(' · ') || roleLabel}
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <span className="chip">{roleLabel}</span>
          {premiumActive ? (
            <span
              className="chip inline-flex items-center gap-1.5"
              style={{ borderColor: ACCENT, color: ACCENT, background: ACCENT_SOFT }}
            >
              <Gem size={12} />
              Premium
            </span>
          ) : (
            <span className="chip text-muted">Free</span>
          )}
        </div>
      </div>

      <div className="card grid grid-cols-4 divide-x divide-border py-4">
        <Stat icon={<Music2 size={16} color={ACCENT} />} value={String(stats.soundsSaved)} label="Sounds Saved" />
        <Stat icon={<Heart size={16} className="text-red-500" />} value={String(stats.favourites)} label="Favorites" />
        <Stat
          icon={<ArrowDownCircle size={16} className="text-green-500" />}
          value={String(stats.downloads)}
          label="Downloads"
        />
        <Stat
          icon={<Clock3 size={16} className="text-sky-400" />}
          value={`${stats.listeningHours}h`}
          label="Listening Time"
        />
      </div>

      <Section title="Account">
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-background/60"
          onClick={() => setEditOpen(true)}
        >
          <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: ACCENT_SOFT }}>
            <Settings2 size={18} color={ACCENT} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-sm">Edit profile</span>
            <span className="block text-xs text-muted mt-0.5">Banner, photo, bio, city, and country.</span>
          </span>
          <ChevronRight size={18} className="text-muted" />
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-background/60 border-t border-border"
          onClick={() => setShareOpen(true)}
        >
          <span className="h-9 w-9 rounded-xl flex items-center justify-center bg-green-500/15">
            <Share2 size={18} className="text-green-500" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-sm">Share app</span>
            <span className="block text-xs text-muted mt-0.5">Send the APK download link to friends.</span>
          </span>
          <ChevronRight size={18} className="text-muted" />
        </button>
        {!isCreator ? (
          <Row
            href="/creator/become"
            icon={<Mic size={18} color={ACCENT} />}
            iconBg={ACCENT_SOFT}
            label="Become a Creator"
            hint="Upload sounds and earn from Premium."
          />
        ) : (
          <Row
            href="/creator"
            icon={<Mic size={18} color={ACCENT} />}
            iconBg={ACCENT_SOFT}
            label="Creator dashboard"
            hint="Uploads, earnings, and verification."
          />
        )}
        <Row
          href="/notifications"
          icon={<Bell size={18} className="text-purple-500" />}
          iconBg="rgba(168,85,247,0.16)"
          label="Notifications"
          hint="Updates, welcome notes and more."
        />
        <Row
          href="/premium"
          icon={<ShieldCheck size={18} className="text-green-500" />}
          iconBg="rgba(34,197,94,0.16)"
          label="Subscription"
          hint="Manage your Premium plan."
          trailing={
            premiumActive ? (
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-full border mr-1"
                style={{ borderColor: ACCENT, color: ACCENT, background: ACCENT_SOFT }}
              >
                Active
              </span>
            ) : null
          }
        />
        {isAdmin ? (
          <Row
            href="/admin"
            icon={<Shield size={18} className="text-sky-400" />}
            iconBg="rgba(96,165,250,0.16)"
            label="Admin hub"
            hint="Moderation, payments, and queues."
          />
        ) : null}
      </Section>

      <Section title="Preferences">
        <Row
          href="/settings"
          icon={<Settings2 size={18} className="text-blue-500" />}
          iconBg="rgba(59,130,246,0.16)"
          label="Settings"
          hint="Theme, volume, downloads, privacy, and more."
        />
      </Section>

      <Section title="Legal">
        <Row
          href="/legal/privacy"
          icon={<FileText size={18} />}
          iconBg="rgba(128,128,128,0.15)"
          label="Privacy Policy"
        />
        <Row
          href="/legal/terms"
          icon={<FileText size={18} />}
          iconBg="rgba(128,128,128,0.15)"
          label="Terms of Use"
        />
      </Section>

      <button
        type="button"
        className="w-full rounded-xl border border-red-500 text-red-500 py-3.5 font-semibold inline-flex items-center justify-center gap-2"
        onClick={() => {
          if (await appConfirm('Sign out of X-Relax?')) void signOut();
        }}
      >
        <LogOut size={18} />
        Sign out
      </button>

      {editOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-border p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-serif font-bold">Edit profile</h2>
            <button
              type="button"
              className="w-full overflow-hidden rounded-xl border border-border"
              onClick={() => bannerRef.current?.click()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {(bannerPreview || profile?.banner_url) ? (
                <img
                  src={bannerPreview ?? profile?.banner_url ?? ''}
                  alt=""
                  className="h-24 w-full object-cover"
                />
              ) : (
                <div className="h-24 w-full bg-background flex items-center justify-center text-sm" style={{ color: ACCENT }}>
                  Add banner
                </div>
              )}
            </button>
            <input
              ref={bannerRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setBannerFile(file);
                if (bannerPreview) URL.revokeObjectURL(bannerPreview);
                setBannerPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
            <button
              type="button"
              className="flex items-center gap-3 text-sm"
              style={{ color: ACCENT }}
              onClick={() => fileRef.current?.click()}
            >
              {avatarUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUri} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <CoverArt title={profile?.display_name ?? 'You'} uri={null} size={56} rounded={28} />
              )}
              Change photo
            </button>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
            />
            <textarea
              className="input min-h-[80px]"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Bio"
            />
            <input
              className="input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
            />
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted">Country / region</span>
              <select
                className="input w-full"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                required
              >
                <option value="">Select your country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn btn-outline flex-1" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shareOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-border p-5 space-y-3">
            <h2 className="text-xl font-serif font-bold">Share X-Relax</h2>
            <p className="text-sm text-muted break-all">{apkUrl || 'Loading download link…'}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn btn-outline"
                disabled={!apkUrl}
                onClick={async () => {
                  await navigator.clipboard.writeText(apkUrl);
                  appAlert('Link copied — paste it to WhatsApp Status or anywhere.');
                }}
              >
                Copy link
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={!apkUrl}
                onClick={() => {
                  const text = encodeURIComponent(
                    `Relax with me on X-Relax — free calming sounds.\n\nDownload:\n${apkUrl}`,
                  );
                  window.open(`https://wa.me/?text=${text}`, '_blank');
                }}
              >
                WhatsApp
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={!apkUrl}
                onClick={async () => {
                  await navigator.clipboard.writeText(apkUrl);
                  const text = encodeURIComponent(
                    `Relax with me on X-Relax — free calming sounds.\n\nDownload:\n${apkUrl}`,
                  );
                  window.open(`https://wa.me/?text=${text}`, '_blank');
                }}
              >
                WA Status
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={!apkUrl}
                onClick={() => {
                  window.open(
                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(apkUrl)}`,
                    '_blank',
                  );
                }}
              >
                Facebook
              </button>
              <button
                type="button"
                className="btn btn-primary col-span-2"
                disabled={!apkUrl}
                onClick={() => {
                  if (navigator.share) {
                    void navigator.share({
                      title: 'X-Relax',
                      text: 'Relax with me on X-Relax',
                      url: apkUrl,
                    });
                  } else {
                    void navigator.clipboard.writeText(apkUrl);
                    appAlert('Link copied');
                  }
                }}
              >
                Share…
              </button>
            </div>
            <button type="button" className="btn btn-outline w-full" onClick={() => setShareOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted mb-2 px-1">{title}</p>
      <div className="card overflow-hidden divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({
  href,
  icon,
  iconBg,
  label,
  hint,
  trailing,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  hint?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-background/60">
      <span
        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-sm">{label}</span>
        {hint ? <span className="block text-xs text-muted mt-0.5">{hint}</span> : null}
      </span>
      {trailing}
      <ChevronRight size={18} className="text-muted shrink-0" />
    </Link>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-1 text-center">
      {icon}
      <p className="font-bold text-base">{value}</p>
      <p className="text-[10px] text-muted leading-tight">{label}</p>
    </div>
  );
}
