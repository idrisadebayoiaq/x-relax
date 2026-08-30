import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  downloadSoundForOffline,
  notifyDownloadComplete,
  type DownloadProgressCallback,
} from '../../lib/downloads';
import type { Sound } from '../../types/database';
import { appAlert } from '../../ui/appAlert';

export type DownloadJob = {
  soundId: string;
  title: string;
  progress: number;
  status: 'downloading' | 'completed' | 'error';
  message?: string;
};

type DownloadContextValue = {
  jobs: DownloadJob[];
  activeJob: DownloadJob | null;
  isDownloading: (soundId: string) => boolean;
  startDownload: (userId: string, sound: Sound) => Promise<{ ok: boolean; message: string }>;
  dismissJob: (soundId: string) => void;
};

const DownloadContext = createContext<DownloadContextValue | null>(null);

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  const patchJob = useCallback((soundId: string, patch: Partial<DownloadJob>) => {
    setJobs((prev) => prev.map((j) => (j.soundId === soundId ? { ...j, ...patch } : j)));
  }, []);

  const startDownload = useCallback(async (userId: string, sound: Sound) => {
    let already = false;
    setJobs((prev) => {
      if (prev.some((j) => j.soundId === sound.id && j.status === 'downloading')) {
        already = true;
        return prev;
      }
      const without = prev.filter((j) => j.soundId !== sound.id);
      return [
        ...without,
        { soundId: sound.id, title: sound.title, progress: 0, status: 'downloading' },
      ];
    });
    if (already) {
      return { ok: false, message: 'Already downloading this sound.' };
    }

    const onProgress: DownloadProgressCallback = (progress) => {
      patchJob(sound.id, { progress });
    };

    const result = await downloadSoundForOffline(userId, sound, onProgress);

    if (result.ok) {
      patchJob(sound.id, { progress: 1, status: 'completed', message: result.message });
      await notifyDownloadComplete(sound.title);
      setTimeout(() => {
        setJobs((prev) => prev.filter((j) => j.soundId !== sound.id));
      }, 4000);
    } else {
      patchJob(sound.id, { status: 'error', message: result.message });
      appAlert('Download failed', result.message);
      setTimeout(() => {
        setJobs((prev) => prev.filter((j) => j.soundId !== sound.id));
      }, 5000);
    }

    return result;
  }, [patchJob]);

  const dismissJob = useCallback((soundId: string) => {
    setJobs((prev) => prev.filter((j) => j.soundId !== soundId));
  }, []);

  const activeJob = jobs.find((j) => j.status === 'downloading') ?? null;

  const value = useMemo<DownloadContextValue>(
    () => ({
      jobs,
      activeJob,
      isDownloading: (soundId) =>
        jobs.some((j) => j.soundId === soundId && j.status === 'downloading'),
      startDownload,
      dismissJob,
    }),
    [jobs, activeJob, startDownload, dismissJob],
  );

  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>;
}

export function useDownloads() {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error('useDownloads must be used within DownloadProvider');
  return ctx;
}
