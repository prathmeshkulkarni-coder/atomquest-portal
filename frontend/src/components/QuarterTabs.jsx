const DEFAULT_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

export default function QuarterTabs({ value, onChange, quarters = DEFAULT_QUARTERS, labels }) {
  return (
    <div className="tab-bar" role="tablist">
      {quarters.map((q) => (
        <button
          key={q}
          type="button"
          role="tab"
          aria-selected={value === q}
          className={`tab-bar-item ${value === q ? 'tab-bar-item--active' : ''}`}
          onClick={() => onChange(q)}
        >
          {labels?.[q] ?? q}
        </button>
      ))}
    </div>
  );
}
