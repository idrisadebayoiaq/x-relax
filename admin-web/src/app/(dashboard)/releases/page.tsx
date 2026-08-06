import { ReleasesEditor } from './ReleasesEditor';

export default function ReleasesPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">App releases</h1>
      <p className="text-muted mt-2 mb-8">
        Upload APK files and control what users see on the website download page — including coming soon cards.
      </p>
      <ReleasesEditor />
    </div>
  );
}
