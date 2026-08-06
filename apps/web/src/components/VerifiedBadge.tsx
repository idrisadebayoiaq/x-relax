export function VerifiedBadge({
  tone = 'white',
  size = 16,
}: {
  tone?: 'white' | 'blue';
  size?: number;
}) {
  const fill = tone === 'blue' ? '#1D4ED8' : '#FFFFFF';
  const check = tone === 'blue' ? '#FFFFFF' : '#111111';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-label={tone === 'blue' ? 'Blue verified badge' : 'Premium verified badge'}
      style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.25))' }}
    >
      <circle cx="12" cy="12" r="11" fill={fill} />
      <path
        d="M7.5 12.5l3 3 6-7"
        fill="none"
        stroke={check}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
