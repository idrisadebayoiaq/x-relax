import { moodPaletteFor } from '@/lib/format';

export function CoverArt({
  title,
  uri,
  size = 120,
  rounded = 16,
}: {
  title: string;
  uri?: string | null;
  size?: number;
  rounded?: number;
}) {
  const [c0, c1] = moodPaletteFor(title);

  if (uri) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={uri}
        alt={title}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: rounded, objectFit: 'cover' }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: `linear-gradient(135deg, ${c0}, ${c1})`,
      }}
      aria-hidden
    />
  );
}
