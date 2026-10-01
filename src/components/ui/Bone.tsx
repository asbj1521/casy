/**
 * A grey, pulsing stand-in for text that hasn't loaded yet, as wide as
 * `chars` digits and exactly as tall as a line of the surrounding text (it is
 * made of figure spaces, which don't collapse or wrap), so the placeholder
 * takes the finished text's room.
 */
export default function Bone({ chars }: { chars: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block max-w-full animate-pulse overflow-hidden whitespace-nowrap rounded-lg bg-secondary"
    >
      {" ".repeat(chars)}
    </span>
  );
}
