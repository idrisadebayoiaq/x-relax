'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatBytes } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import type { AppRelease } from '@/types/database';

export default function DownloadPage() {
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .from('app_releases')
      .select('*')
      .neq('status', 'archived')
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setReleases((data as AppRelease[]) ?? []);
        setLoading(false);
      });
  }, []);

  const apkUrl = (release: AppRelease) => {
    if (!release.apk_path) return null;
    const { data } = createClient().storage.from('app-releases').getPublicUrl(release.apk_path);
    return data.publicUrl;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold">Download X-Relax</h1>
        <p className="text-muted mt-2">
          Install the Android app for the best experience. Premium members can download sounds and listen offline.
        </p>
      </div>

      {loading ? <p className="text-muted">Loading releases…</p> : null}

      {!loading && releases.length === 0 ? (
        <div className="card p-6 text-center space-y-2">
          <p className="font-semibold">Mobile app coming soon</p>
          <p className="text-sm text-muted">Check back here for the APK when it is ready.</p>
        </div>
      ) : null}

      <div className="space-y-4">
        {releases.map((release) => {
          const url = apkUrl(release);
          const isAvailable = release.status === 'available' && !!url;
          return (
            <div key={release.id} className="card p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-lg">{release.title}</p>
                  <p className="text-sm text-muted">Version {release.version}</p>
                </div>
                <span
                  className={`chip ${release.status === 'available' ? 'chip-active' : ''}`}
                >
                  {release.status === 'coming_soon'
                    ? 'Coming soon'
                    : release.status === 'available'
                      ? 'Available'
                      : release.status}
                </span>
              </div>
              {release.description ? (
                <p className="text-sm text-muted whitespace-pre-line">{release.description}</p>
              ) : null}
              {isAvailable ? (
                <div className="flex flex-wrap items-center gap-3">
                  <a href={url!} download className="btn btn-primary">
                    Download APK
                  </a>
                  <span className="text-sm text-muted">{formatBytes(release.file_size_bytes)}</span>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {release.status === 'coming_soon'
                    ? 'This version is not available for download yet.'
                    : 'APK file not uploaded yet.'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted">
        Already using the web app?{' '}
        <Link href="/" className="underline">
          Go to home
        </Link>
      </p>
    </div>
  );
}
