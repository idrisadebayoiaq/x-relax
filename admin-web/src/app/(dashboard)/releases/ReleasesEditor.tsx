'use client';

import { useEffect, useState } from 'react';
import { ActionButton } from '@/components/ActionButton';
import { formatBytes } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import type { AppRelease, AppReleaseStatus } from '@/types/database';

const STATUSES: AppReleaseStatus[] = ['coming_soon', 'available', 'archived'];
const consumerWebUrl = process.env.NEXT_PUBLIC_CONSUMER_WEB_URL ?? 'http://localhost:3001';

export function ReleasesEditor() {
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    version: '',
    title: '',
    description: '',
    status: 'coming_soon' as AppReleaseStatus,
    sort_order: 0,
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
    void load();
  }, []);

  const resetForm = () => {
    setForm({ version: '', title: '', description: '', status: 'coming_soon', sort_order: 0 });
    setApkFile(null);
    setEditingId(null);
  };

  const saveRelease = async () => {
    if (!form.version.trim() || !form.title.trim()) {
      alert('Version and title are required.');
      return;
    }
    setBusy(true);
    const supabase = createClient();
    let apkPath: string | null = null;
    let fileSize: number | null = null;

    if (apkFile) {
      const safeVersion = form.version.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
      apkPath = `${safeVersion}/x-relax-${safeVersion}.apk`;
      const { error: uploadError } = await supabase.storage
        .from('app-releases')
        .upload(apkPath, apkFile, {
          upsert: true,
          contentType: 'application/vnd.android.package-archive',
        });
      if (uploadError) {
        setBusy(false);
        alert(uploadError.message);
        return;
      }
      fileSize = apkFile.size;
    }

    const payload = {
      version: form.version.trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      sort_order: form.sort_order,
      updated_at: new Date().toISOString(),
      ...(apkPath ? { apk_path: apkPath, file_size_bytes: fileSize } : {}),
    };

    const { error } = editingId
      ? await supabase.from('app_releases').update(payload).eq('id', editingId)
      : await supabase.from('app_releases').insert(payload);

    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }

    await supabase.rpc('log_admin_action', {
      p_action: editingId ? 'update_app_release' : 'create_app_release',
      p_entity_type: 'app_release',
      p_entity_id: editingId ?? undefined,
      p_meta: { version: form.version.trim(), status: form.status },
    });

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
    });
    setApkFile(null);
  };

  const deleteRelease = async (id: string) => {
    if (!confirm('Delete this release entry?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('app_releases').delete().eq('id', id);
    if (error) alert(error.message);
    else {
      await supabase.rpc('log_admin_action', {
        p_action: 'delete_app_release',
        p_entity_type: 'app_release',
        p_entity_id: id,
      });
      void load();
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <p className="text-sm text-muted">
        Public page:{' '}
        <a href={`${consumerWebUrl}/download`} className="underline" target="_blank" rel="noreferrer">
          {consumerWebUrl}/download
        </a>
      </p>

      <div className="border border-border bg-surface rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">{editingId ? 'Edit release' : 'New release'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="w-full border border-border bg-background rounded-lg px-3 py-2"
            placeholder="Version (e.g. 1.2.0)"
            value={form.version}
            onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
          />
          <input
            className="w-full border border-border bg-background rounded-lg px-3 py-2"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <textarea
          className="w-full border border-border bg-background rounded-lg px-3 py-2 min-h-[80px]"
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="w-full border border-border bg-background rounded-lg px-3 py-2"
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
            className="w-full border border-border bg-background rounded-lg px-3 py-2"
            type="number"
            placeholder="Sort order (higher = first)"
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted block mb-2">APK file</label>
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive,application/octet-stream"
            onChange={(e) => setApkFile(e.target.files?.[0] ?? null)}
          />
          {apkFile ? (
            <p className="text-sm text-muted mt-1">
              {apkFile.name} · {formatBytes(apkFile.size)}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-accent text-on-accent px-4 py-2 text-sm font-semibold disabled:opacity-50"
            onClick={() => void saveRelease()}
          >
            {busy ? 'Saving…' : editingId ? 'Update release' : 'Create release'}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm"
              onClick={resetForm}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">All releases</h2>
        {releases.length === 0 ? (
          <p className="text-sm text-muted">No releases yet. Create a &quot;Coming soon&quot; card or upload an APK.</p>
        ) : null}
        {releases.map((release) => (
          <div key={release.id} className="border border-border bg-surface rounded-xl p-4 space-y-2">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold">{release.title}</p>
                <p className="text-sm text-muted">
                  v{release.version} · {release.status}
                  {release.file_size_bytes ? ` · ${formatBytes(release.file_size_bytes)}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <ActionButton label="Edit" onAction={async () => editRelease(release)} />
                <ActionButton label="Delete" onAction={async () => deleteRelease(release.id)} />
              </div>
            </div>
            {release.description ? <p className="text-sm text-muted">{release.description}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
