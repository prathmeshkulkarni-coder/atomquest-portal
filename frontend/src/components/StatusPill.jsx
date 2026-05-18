const MAP = {
  'Not Started': 'not-started',
  'On Track': 'on-track',
  Completed: 'completed',
};

export default function StatusPill({ status }) {
  const key = MAP[status] || 'not-started';
  return <span className={`status-pill status-pill--${key}`}>{status}</span>;
}
