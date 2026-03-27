/**
 * Soft expanding rings — ambient “live” cue in the corner (Apple.com–style restraint).
 */
export default function SonarAmbient() {
  return (
    <div
      className="sonar-ambient pointer-events-none fixed bottom-6 right-6 z-[5] md:bottom-10 md:right-10"
      aria-hidden
    >
      <div className="relative flex h-[7.5rem] w-[7.5rem] items-center justify-center">
        <span className="sonar-ambient__core" />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="sonar-ambient__ring"
            style={{ animationDelay: `${i * 1.05}s` }}
          />
        ))}
      </div>
    </div>
  );
}
