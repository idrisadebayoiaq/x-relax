# Payment Details — Manual Premium Verification

> **Security:** Keep this repo private. Do not publish these details to a public GitHub repo or screenshot them into social posts. The in-app UI should show only what listeners need to pay; routing numbers and full bank address can stay on the payment screen for USD transfers.

These details are shown to users who choose **manual bank / transfer** to buy Premium. Admins verify deposits against bank statements, then approve the payment request in the admin tools.

---

## USD account (Lead Bank)

| Field | Value |
|-------|--------|
| Account name | Quoreeb Adebayo Idris |
| Bank name | Lead Bank |
| Account number | 217034703468 |
| Account type | Checking |
| Routing number | 101019644 |
| Bank address | 1801 Main St. Kansas City, MO 64108, USA |

### In-app USD instruction copy (suggested)

```
Pay via USD bank transfer, then upload your receipt.

Account name: Quoreeb Adebayo Idris
Bank: Lead Bank
Account number: 217034703468
Account type: Checking
Routing number: 101019644
Bank address: 1801 Main St. Kansas City, MO 64108, USA

Include your X-Relax email in the transfer memo if possible.
After paying, upload proof in the app and wait for approval.
```

---

## Nigeria account (Opay)

| Field | Value |
|-------|--------|
| Account number | 7069655207 |
| Bank / wallet | Opay |
| Account name | Quoreeb Adebayo Idris |

### In-app NGN instruction copy (suggested)

```
Pay via Opay transfer, then upload your receipt.

Account number: 7069655207
Bank: Opay
Account name: Quoreeb Adebayo Idris

Use your X-Relax email as the transfer narration if possible.
After paying, upload proof in the app and wait for approval.
```

---

## How this plugs into the product

1. User selects a Premium plan (Monthly / Quarterly / Yearly / Lifetime).
2. User chooses payment method: **USD transfer** or **NGN Opay**.
3. App shows the matching instructions from this file (loaded from `app_settings` in Supabase — not hardcoded only in the client).
4. User uploads proof → creates `payment_requests` row + optional chat message with image.
5. Finance / Super Admin checks the real bank/Opay inbox.
6. Admin sets status to **Approved** → subscription / Premium role activated.
7. If unclear → **Need More Info** via payment chat.

## Storage of proofs

- Bucket: `payment-proofs/`
- Path pattern: `{user_id}/{payment_request_id}/{filename}`
- RLS: user can upload/read own proofs; admins can read all

## Seed into `app_settings` (Phase 3)

Store JSON roughly like:

```json
{
  "payment_methods": {
    "usd_lead_bank": {
      "label": "USD Bank Transfer",
      "currency": "USD",
      "account_name": "Quoreeb Adebayo Idris",
      "bank_name": "Lead Bank",
      "account_number": "217034703468",
      "account_type": "Checking",
      "routing_number": "101019644",
      "bank_address": "1801 Main St. Kansas City, MO 64108, USA"
    },
    "ngn_opay": {
      "label": "Nigeria Opay",
      "currency": "NGN",
      "account_name": "Quoreeb Adebayo Idris",
      "bank_name": "Opay",
      "account_number": "7069655207"
    }
  }
}
```

Update prices separately under `subscription_plans` / `app_settings.plans` when you decide amounts.
