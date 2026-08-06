# send-push

Deployed to Supabase project `bfilhkxyjiofkfqwqyep`.

Re-deploy via Cursor Supabase MCP `deploy_edge_function` or Dashboard.
Source of truth after deploy lives on the remote function version.

Auth:
- Header `x-push-secret` matching Vault `push_dispatch_secret` (DB trigger)
- Or user JWT (admin for broadcast / self for test)

Reads Vault via RPC `get_vault_secret`:
- `firebase_service_account`
- `push_dispatch_secret`

## Welcome push

On signup, `handle_new_user` inserts an in-app notification titled **Welcome to X-Relax**.

Delivery:
1. **In-app** — Home `WelcomeBanner` + Profile → Notifications
2. **FCM** — `upsert_push_token` dispatches once when the first device token is stored (welcome still unread)
3. **Local tray** — mobile `presentWelcomePushIfNeeded()` shows a system notification after push permission is granted
