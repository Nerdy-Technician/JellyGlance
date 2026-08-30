export default function RequestTimeline({ request }) {
  const timeline = Array.isArray(request?.timeline) && request.timeline.length
    ? request.timeline
    : [
        { id: "requested", label: "Requested", state: "current" },
        { id: "approved", label: "Approved", state: "upcoming" },
        { id: "grabbed", label: "Grabbed", state: "upcoming" },
        { id: "available", label: "Available", state: "upcoming" },
      ];

  return (
    <ol className="requests-timeline" aria-label="Request status timeline">
      {timeline.map((step) => (
        <li key={step.id} className={`is-${step.state}`}>
          <span className="requests-timeline-dot" aria-hidden="true" />
          <strong>{step.label}</strong>
        </li>
      ))}
    </ol>
  );
}
