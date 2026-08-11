'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useWebTheme, type ThemePreference } from '@/lib/theme-context';
import { useWebSettings, type AudioQuality, type DownloadNetworkMode } from '@/lib/settings-context';

export default function SettingsPage() {
  const { user, profile, isPremium, isCreator, isAdmin, signOut } = useAuth();
  const { preference, setPreference } = useWebTheme();
  const { settings, updateSettings } = useWebSettings();
  const [apkUrl, setApkUrl] = useState('');
  const [busyDelete, setBusyDelete] = useState(false);
  const version = '1.0.11';

  const loadApk = async () => {
    const { data } = await createClient()
      .from('app_releases')
      .select('download_url, apk_path, status')
      .neq('status', 'archived')
      .order('sort_order', { ascending: true })
      .limit(1);
    const row = data?.[0] as { download_url?: string | null; apk_path?: string | null } | undefined;
    setApkUrl(row?.download_url || row?.apk_path || '');
  };

  const deleteAccount = async () => {
    if (!confirm('Delete your account permanently? This cannot be undone.')) return;
    if (!confirm('Final confirmation: delete account forever?')) return;
    setBusyDelete(true);
    const { data, error } = await createClient().rpc('delete_own_account');
    setBusyDelete(false);
    const payload = data as { ok?: boolean; error?: string } | null;
    if (error || !payload?.ok) {
      alert(payload?.error ?? error?.message ?? 'Could not delete account');
      return;
    }
    await signOut();
    window.location.href = '/login';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-serif font-bold tracking-tight">Settings</h1>
        <p className="text-muted mt-1">Theme, downloads, account, and more.</p>
      </div>

      <Section title="Appearance">
        {([
          ['system', 'System'],
          ['light', 'Light'],
          ['dark', 'Dark'],
        ] as [ThemePreference, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-background/60 ${
              preference === key ? 'font-semibold' : ''
            }`}
            onClick={() => void setPreference(key)}
          >
            {label}
            {preference === key ? ' ✓' : ''}
          </button>
        ))}
      </Section>

      <Section title="Volume">
        <div className="px-4 py-4">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.volume}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            className="w-full"
          />
          <p className="text-xs text-muted mt-2">{Math.round(settings.volume * 100)}%</p>
        </div>
      </Section>

      <Section title="Audio quality">
        {([
          ['auto', 'Auto'],
          ['high', 'High'],
          ['data_saver', 'Data saver'],
        ] as [AudioQuality, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`w-full text-left px-4 py-3 border-b border-border last:border-0 ${
              settings.audioQuality === key ? 'font-semibold' : ''
            }`}
            onClick={() => updateSettings({ audioQuality: key })}
          >
            {label}
            {settings.audioQuality === key ? ' ✓' : ''}
          </button>
        ))}
      </Section>

      <Section title="Downloads">
        <p className="text-xs text-muted px-4 pt-3">
          Wi‑Fi only blocks downloads on mobile data. Cellular allows Wi‑Fi and mobile data.
        </p>
        {([
          ['wifi', 'Over Wi‑Fi only'],
          ['cellular', 'Wi‑Fi + cellular data'],
        ] as [DownloadNetworkMode, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`w-full text-left px-4 py-3 border-b border-border last:border-0 ${
              settings.downloadNetwork === key ? 'font-semibold' : ''
            }`}
            onClick={() => updateSettings({ downloadNetwork: key })}
          >
            {label}
            {settings.downloadNetwork === key ? ' ✓' : ''}
          </button>
        ))}
      </Section>

      <Section title="Account">
        <Link href="/premium" className="block px-4 py-3 border-b border-border hover:bg-background/60">
          Premium & plan {isPremium ? '· Active' : ''}
        </Link>
        <Link href="/payments" className="block px-4 py-3 border-b border-border hover:bg-background/60">
          My payments
        </Link>
        {isCreator ? (
          <Link href="/creator/verification" className="block px-4 py-3 border-b border-border hover:bg-background/60">
            Verification
          </Link>
        ) : (
          <Link href="/creator/become" className="block px-4 py-3 border-b border-border hover:bg-background/60">
            Become a creator
          </Link>
        )}
        {isAdmin ? (
          <Link href="/admin" className="block px-4 py-3 hover:bg-background/60">
            Admin hub
          </Link>
        ) : null}
      </Section>

      <Section title="Share & legal">
        <button
          type="button"
          className="w-full text-left px-4 py-3 border-b border-border hover:bg-background/60"
          onClick={async () => {
            if (!apkUrl) await loadApk();
            const url =
              apkUrl ||
              (
                await createClient()
                  .from('app_releases')
                  .select('download_url')
                  .eq('status', 'available')
                  .limit(1)
                  .maybeSingle()
              ).data?.download_url ||
              '';
            if (!url) return alert('No download link available');
            await navigator.clipboard.writeText(url);
            alert('APK link copied');
          }}
        >
          Share app (copy APK link)
        </button>
        <Link href="/legal/privacy" className="block px-4 py-3 border-b border-border hover:bg-background/60">
          Privacy policy
        </Link>
        <Link href="/legal/terms" className="block px-4 py-3 hover:bg-background/60">
          Terms of use
        </Link>
      </Section>

      <Section title="About">
        <div className="px-4 py-3 flex justify-between border-b border-border">
          <span>Version</span>
          <span className="text-muted">{version}</span>
        </div>
        <div className="px-4 py-3 flex justify-between">
          <span>Signed in as</span>
          <span className="text-muted truncate max-w-[50%]">{profile?.display_name ?? 'Listener'}</span>
        </div>
      </Section>

      <button
        type="button"
        className="w-full rounded-xl border border-red-500 text-red-500 py-3.5 font-semibold"
        disabled={busyDelete || !user}
        onClick={() => void deleteAccount()}
      >
        {busyDelete ? 'Deleting…' : 'Delete account'}
      </button>
      <button
        type="button"
        className="w-full rounded-xl border border-border py-3.5 font-semibold"
        onClick={() => {
          if (confirm('Sign out of X-Relax?')) void signOut();
        }}
      >
        Sign out
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted mb-2 px-1">{title}</p>
      <div className="card overflow-hidden">{children}</div>
    </div>
  );
}
