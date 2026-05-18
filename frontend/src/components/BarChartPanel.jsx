/** Horizontal bar chart driven by real analytics rows. */
export default function BarChartPanel({ title, subtitle, rows, labelKey, valueKey, emptyText = 'No data yet.' }) {
  if (!rows?.length) {
    return (
      <section className="panel chart-panel">
        <header className="panel-head">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </header>
        <div className="panel-body">
          <p className="empty-state">{emptyText}</p>
        </div>
      </section>
    );
  }

  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);

  return (
    <section className="panel chart-panel">
      <header className="panel-head">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <div className="panel-body">
        <div className="bar-chart">
          {rows.map((row) => {
            const label = row[labelKey];
            const value = Number(row[valueKey]) || 0;
            return (
              <div key={String(label)} className="bar-row">
                <span className="bar-label" title={label}>
                  {label}
                </span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(value / max) * 100}%` }} />
                </div>
                <span className="bar-value">{value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
