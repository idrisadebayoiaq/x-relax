const DOCS = {
  privacy: {
    title: 'Privacy Policy',
    body: `Privacy Policy (draft)
Last updated: 2026-07-30

What we collect
• Account: email, password (hashed), display name, role
• Profile: optional bio, avatar, creator verification documents
• Usage: play history, favourites, playlists, ratings, mix preferences
• Payments: manual payment requests and proof images

How we use data
• Provide playback, library, Premium, and creator features
• Review payments, content, verifications, and withdrawals
• Send in-app notifications about your account

Contact: support@x-relax.app`,
  },
  terms: {
    title: 'Terms of Use',
    body: `Terms of Use (draft)
Last updated: 2026-07-30

Accounts
• Provide accurate information and keep credentials secure
• Signup roles: Listener or Creator; Admin is assigned by operators

Content
• Streaming is for personal, non-commercial use unless otherwise agreed
• Premium follows the plan rules shown in-app
• Manual payments are verified by staff

Creators
• You warrant you own or have rights to uploaded audio and artwork
• Earnings and withdrawals follow in-app rules

Contact: support@x-relax.app`,
  },
};

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const content = DOCS[doc as keyof typeof DOCS] ?? DOCS.privacy;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-3xl font-serif font-bold">{content.title}</h1>
      <p className="text-sm text-muted">Draft for internal testing</p>
      <pre className="card p-6 whitespace-pre-wrap text-sm text-muted font-sans">{content.body}</pre>
    </div>
  );
}
