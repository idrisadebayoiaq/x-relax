import { AnnouncementForm } from './AnnouncementForm';

export default function AnnouncementsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Announcements</h1>
        <p className="text-muted mt-2">
          Broadcast in-app + Firebase Cloud Messaging push to registered devices
        </p>
      </div>
      <AnnouncementForm />
    </div>
  );
}
