'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatBytes } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { AppRelease, AppReleaseStatus } from '@/types/database';
import { appAlert, appConfirm } from '@/components/AppDialog';

const STATUSES: AppReleaseStatus[] = ['coming_soon', 'available', 'archived'];
/** Supabase Free global Storage limit is 50MB; APKs are usually larger. */
const MAX_DIRECT_UPLOAD_BYTES = 45 * 1024 * 1024;

export default function AdminReleasesPage() {
  const { isAdmin } = useAuth();
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    version: '',
    title: '',
    description: '',
    status: 'coming_soon' as AppReleaseStatus,
    sort_order: 0,
    download_url: '',
  });
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await createClient()
      .from('app_releases')
      .select('*')
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false });
    setReleases((data as AppRelease[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const resetForm = () => {
    setForm({
      version: '',
      title: '',
      description: '',
      status: 'coming_soon',
      sort_order: 0,
      download_url: '',
    });
    setApkFile(null);
    setEditingId(null);
  };

  const saveRelease = async () => {
    if (!form.version.trim() || !form.title.trim()) {
      appAlert('Version and title are required.');
      return;
    }
    setBusy(true);
    const supabase = createClient();
    let apkPath: string | null = null;
    let fileSize: number | null = null;
    const externalUrl = form.download_url.trim() || null;

    if (apkFile) {
      if (apkFile.size > MAX_DIRECT_UPLOAD_BYTES) {
        setBusy(false);
        return appAlert(
          `This APK is ${formatBytes(apkFile.size)}. Direct uploads are limited (~50MB on Free plans).\n\nPaste the Expo APK download link in “APK download URL” instead, or raise the global Storage file size limit in the Supabase dashboard (Pro).`,
        );
      }
      const safeVersion = form.version.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
      apkPath = `${safeVersion}/x-relax-${safeVersion}.apk`;
      const { error: uploadError } = await supabase.storage
        .from('app-releases')
        .upload(apkPath, apkFile, {
          upsert: true,
          contentType: 'application/vnd.android.package-archive',
          cacheControl: '3600',
        });
      if (uploadError) {
        setBusy(false);
        return appAlert(uploadError.message || 'APK upload failed.');
      }
      fileSize = apkFile.size;
    }

    const payload = {
      version: form.version.trim().replace(/^v/i, ''),
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      sort_order: form.sort_order,
      updated_at: new Date().toISOString(),
      ...(externalUrl ? { download_url: externalUrl } : {}),
      ...(apkPath ? { apk_path: apkPath, file_size_bytes: fileSize } : {}),
    };

    if (editingId) {
      const { error } = await supabase.from('app_releases').update(payload).eq('id', editingId);
      setBusy(false);
      if (error) return appAlert(error.message);
    } else {
      const { error } = await supabase.from('app_releases').insert(payload);
      setBusy(false);
      if (error) return appAlert(error.message);
    }

    resetForm();
    void load();
  };

  const editRelease = (release: AppRelease) => {
    setEditingId(release.id);
    setForm({
      version: release.version,
      title: release.title,
      description: release.description ?? '',
      status: release.status,
      sort_order: release.sort_order,
      download_url: release.download_url ?? '',
    });
    setApkFile(null);
  };

  const deleteRelease = async (id: string) => {
    if (!(await appConfirm('Delete this release entry?'))) return;
    const { error } = await createClient().from('app_releases').delete().eq('id', id);
    if (error) appAlert(error.message);
    else void load();
  };

  if (!isAdmin) return <p className="text-muted">Admin only.</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">App releases</h2>
        <Link href="/download" className="text-sm text-muted underline">
          Public download page →
        </Link>
      </div>
      <p className="text-muted text-sm">
        Large APKs (over ~50MB) should use an Expo download URL. Direct file upload only works under the
        Storage size limit.
      </p>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">{editingId ? 'Edit release' : 'New release'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="input"
            placeholder="Version (e.g. 1.0.9)"
            value={form.version}
            onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Title (e.g. X-Relax v1.0.9)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <textarea
          className="input min-h-[80px]"
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="input"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AppReleaseStatus }))}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'coming_soon' ? 'Coming soon' : s === 'available' ? 'Available' : 'Archived'}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            placeholder="Sort order (higher = first)"
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <label className="text-sm text-muted block mb-2">
            APK download URL (recommended for large builds)
          </label>
          <input
            className="input"
            placeholder="https://expo.dev/artifacts/eas/….apk"
            value={form.download_url}
            onChange={(e) => setForm((f) => ({ ...f, download_url: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm text-muted block mb-2">
            Or upload APK file (under ~45MB only)
          </label>
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive,application/octet-stream"
            onChange={(e) => setApkFile(e.target.files?.[0] ?? null)}
          />
          {apkFile ? (
            <p className="text-sm text-muted mt-1">
              {apkFile.name} · {formatBytes(apkFile.size)}
              {apkFile.size > MAX_DIRECT_UPLOAD_BYTES ? ' · too large for direct upload' : ''}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveRelease()}>
            {editingId ? 'Update release' : 'Create release'}
          </button>
          {editingId ? (
            <button type="button" className="btn btn-outline" onClick={resetForm}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">All releases</h2>
        {releases.map((release) => (
          <div key={release.id} className="card p-4 space-y-2">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold">{release.title}</p>
                <p className="text-sm text-muted">
                  v{release.version} · {release.status}
                  {release.file_size_bytes ? ` · ${formatBytes(release.file_size_bytes)}` : ''}
                  {release.download_url ? ' · external URL' : ''}
                  {release.apk_path ? ' · stored file' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="chip" onClick={() => editRelease(release)}>
                  Edit
                </button>
                <button type="button" className="chip" onClick={() => void deleteRelease(release.id)}>
                  Delete
                </button>
              </div>
            </div>
            {release.description ? <p className="text-sm text-muted">{release.description}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
