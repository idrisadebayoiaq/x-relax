export function getAdminDashboardUrl(): string {
  return process.env.EXPO_PUBLIC_ADMIN_WEB_URL ?? 'http://localhost:3000';
}
