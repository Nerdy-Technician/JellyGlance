export default function RequestSkeleton({ count = 6 }) {
  return (
    <div className="requests-board is-cards requests-skeleton-board" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article key={index} className="requests-skeleton-card">
          <div className="requests-skeleton-poster" />
          <div className="requests-skeleton-lines">
            <span />
            <span />
            <span />
          </div>
        </article>
      ))}
    </div>
  );
}
