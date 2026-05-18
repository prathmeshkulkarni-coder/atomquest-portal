export default function StatCard({ label, value, hint, accent, icon: Icon, meter }) {
  return (
    <div className={`stat-card ${accent ? `stat-card--${accent}` : ''}`}>
      <div className="stat-card-top">
        <div>
          <span className="stat-card-label">{label}</span>
          <span className="stat-card-value">{value}</span>
        </div>
        {Icon && (
          <span className="stat-card-icon">
            <Icon size={18} />
          </span>
        )}
      </div>
      {meter !== undefined && (
        <div className="weight-meter">
          <div
            className={`weight-meter-fill ${
              meter >= 99.99 && meter <= 100.01
                ? 'weight-meter-fill--ok'
                : meter > 100
                  ? 'weight-meter-fill--over'
                  : ''
            }`}
            style={{ width: `${Math.min(meter, 100)}%` }}
          />
        </div>
      )}
      {hint && <span className="stat-card-hint">{hint}</span>}
    </div>
  );
}
