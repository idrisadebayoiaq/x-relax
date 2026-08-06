'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

type Requirement = {
  key: string;
  label: string;
  required: number;
  current: number;
  met: boolean;
};

type EarnStatus = {
  eligible: boolean;
  can_earn: boolean;
  is_verified: boolean;
  has_blue_badge: boolean;
  latest_status: string | null;
  requirements: Requirement[];
};

const DOC_TYPES = [
  { id: 'national_id', label: 'National ID' },
  { id: 'voters_id', label: "Voter's ID" },
  { id: 'drivers_license', label: "Driver's license" },
  { id: 'passport', label: 'Passport' },
  { id: 'other', label: 'Other government ID' },
] as const;

export default function CreatorVerificationPage() {
  const { user, isCreator } = useAuth();
  const [status, setStatus] = useState<EarnStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]['id']>('national_id');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !isCreator) return;
    const { data } = await createClient().rpc('get_creator_earn_requirements');
    setStatus((data as EarnStatus) ?? null);
  }, [user, isCreator]);

  useEffect(() => {
    void load();
  }, [load]);

  const checklist = useMemo(
    () => (status?.requirements ?? []).filter((r) => r.key !== 'identity'),
    [status],
  );
  const eligible = !!status?.eligible;
  const canEarn = !!status?.can_earn;
  const pending = status?.latest_status === 'pending';

  if (!isCreator) return <p className="text-muted">Creator access required.</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setMessage(null);
    if (!eligible) {
      setMessage('Requirements not met. You cannot verify identity or submit yet.');
      return;
    }
    if (!file) {
      setMessage('Upload a government ID document.');
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const path = `${user.id}/id-${Date.now()}.${file.name.split('.').pop() || 'bin'}`;
    const { error: upErr } = await supabase.storage
      .from('artist-documents')
      .upload(path, file, { upsert: true });
    if (upErr) {
      setBusy(false);
      setMessage(upErr.message);
      return;
    }
    const { error } = await supabase.rpc('submit_creator_verification', {
      p_document_path: path,
      p_note: note.trim() || null,
      p_document_type: docType,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage('Submitted. Admins will review your earning application.');
      setFile(null);
      await load();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/creator" className="text-sm text-muted underline">
        ← Creator
      </Link>
      <div>
        <h1 className="text-3xl font-serif font-bold">Apply to earn</h1>
        <p className="text-muted mt-2">
          Meet the requirements, verify your identity, then admins approve your earning request.
        </p>
      </div>

      <div className="card p-4">
        <p className="text-xs uppercase tracking-wider text-muted">Application status</p>
        <p className="text-2xl font-serif font-bold mt-1 capitalize">
          {canEarn ? 'approved to earn' : status?.latest_status ?? 'not applied'}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Requirements</h2>
        {checklist.map((item) => (
          <div key={item.key} className="card p-4 flex gap-3 items-start">
            <span className={item.met ? 'text-green-700' : 'text-muted'}>{item.met ? '✓' : '○'}</span>
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-muted">
                Progress: {String(item.current)} / {String(item.required)}
              </p>
            </div>
          </div>
        ))}
      </section>

      {!eligible && !canEarn ? (
        <div className="card p-4 space-y-2">
          <p className="font-semibold">Requirements not met</p>
          <p className="text-sm text-muted">
            Keep uploading and growing. Identity verification and earning submission stay locked
            until every requirement is complete.
          </p>
        </div>
      ) : null}

      {canEarn ? (
        <div className="card p-4 space-y-2">
          <p className="font-semibold">You can earn</p>
          <p className="text-sm text-muted">
            Identity approved. Request withdrawals from the withdrawals page when you have a balance.
          </p>
          <Link href="/creator/withdrawals" className="btn btn-outline inline-block">
            Open withdrawals
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card p-6 space-y-4">
          <h2 className="font-semibold">Identity verification</h2>
          <p className="text-sm text-muted">
            Choose ID type and upload a clear photo or PDF. Admins review before you can earn.
          </p>
          <div className="flex flex-wrap gap-2">
            {DOC_TYPES.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={!eligible || pending}
                className={`chip ${docType === d.id ? 'chip-active' : ''}`}
                onClick={() => setDocType(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <input
            type="file"
            accept="image/*,application/pdf"
            disabled={!eligible || pending}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <textarea
            className="input min-h-[80px]"
            placeholder="Optional note for admins"
            value={note}
            disabled={!eligible || pending}
            onChange={(e) => setNote(e.target.value)}
          />
          {message ? <p className="text-sm text-muted">{message}</p> : null}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={busy || !eligible || pending}
          >
            {pending ? 'Pending review' : busy ? 'Submitting…' : 'Submit earning request'}
          </button>
        </form>
      )}

      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">Blue verified badge</h2>
        <p className="text-sm text-muted">
          Approved Apply to Earn creators get the blue badge. Premium listeners get a white badge.
          Admins need a super admin to grant their blue badge.
        </p>
        {canEarn || status?.is_verified ? (
          <p className="font-semibold">Blue creator badge active</p>
        ) : null}
      </section>
    </div>
  );
}
