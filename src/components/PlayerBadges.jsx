export default function PlayerBadges({
  badges = [],
  max = 2,
  compact = false,
}) {
  if (!badges || badges.length === 0) return null;

  const visible = badges.slice(0, max);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {visible.map((badge) => (
        <span
          key={badge.id}
          title={badge.tooltip || badge.label}
          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-extrabold leading-none ${badge.className}`}
        >
          <span>{badge.emoji}</span>
          {!compact && <span className="hidden sm:inline">{badge.label}</span>}
        </span>
      ))}
    </span>
  );
}