import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';

const CycleBanner = ({ token }) => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/cycles/status', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, [token]);

  if (!status) return null;

  return (
    <div className="cycle-banner" data-testid="cycle-banner">
      <Calendar size={18} />
      <div className="cycle-banner-text">
        <strong>
          {status.bypass ? 'Demo mode: all windows open' : status.activeLabel}
        </strong>
        {!status.bypass && (
          <span>
            {status.windows
              .filter((w) => w.isOpen)
              .map((w) => w.label)
              .join(' · ') || 'No BRD window is open today'}
          </span>
        )}
      </div>
    </div>
  );
};

export default CycleBanner;
