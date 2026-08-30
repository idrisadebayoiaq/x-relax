import { DOCS } from '@/lib/legal-content';

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const content = DOCS[doc as keyof typeof DOCS] ?? DOCS.privacy;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      <h1 className="text-3xl font-serif font-bold">{content.title}</h1>
      <p className="text-sm text-muted">Please read carefully</p>
      <pre className="card p-6 whitespace-pre-wrap text-sm text-muted font-sans leading-relaxed">
        {content.body}
      </pre>
    </div>
  );
}
