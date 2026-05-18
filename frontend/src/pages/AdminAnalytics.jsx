import React, { useState, useEffect } from 'react';
import { Download, Unlock, RefreshCw } from 'lucide-react';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import BarChartPanel from '../components/BarChartPanel';
import { UOM_OPTIONS, parseUomSelection, toUomSelectionKey } from '../constants/uom';

const AdminAnalytics = ({ token }) => {
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState(null);
  const [distribution, setDistribution] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [thrustArea, setThrustArea] = useState('Quality Assurance');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uomSelection, setUomSelection] = useState('%|Min');
  const [target, setTarget] = useState('');
  const [weightage, setWeightage] = useState(15);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [cycleSettings, setCycleSettings] = useState(null);

  useEffect(() => {
    fetchAdminData();
    fetch('/api/cycles/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setCycleSettings)
      .catch(() => {});
  }, []);

  const { uom, uom_direction: uomDirection } = parseUomSelection(uomSelection);

  const fetchAdminData = async () => {
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, distRes, auditRes, empRes] = await Promise.all([
        fetch('/api/analytics/completion', { headers }),
        fetch('/api/analytics/distribution', { headers }),
        fetch('/api/goals/audit', { headers }),
        fetch('/api/auth/hierarchy', { headers }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (distRes.ok) setDistribution(await distRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(data.filter((u) => u.role === 'Employee' || u.role === 'Manager' || u.role === 'Admin'));
      }
    } catch {
      setError('Failed to load administration data.');
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/analytics/export', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        setError('Export failed.');
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Goal_Achievement_Report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setSuccess('Report downloaded.');
    } catch {
      setError('Export failed.');
    }
  };

  const handleUnlockGoals = async (empId, empName) => {
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/goals/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employeeId: empId }),
      });
      if (response.ok) {
        setSuccess(`${empName}'s goal sheet is unlocked for editing.`);
        fetchAdminData();
      } else {
        const data = await response.json();
        setError(data.message || 'Unlock failed');
      }
    } catch {
      setError('Unable to reach the server.');
    }
  };

  const handlePushSharedGoal = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!title || !target || selectedRecipients.length === 0) {
      setError('Complete all fields and select at least one employee.');
      return;
    }
    try {
      const response = await fetch('/api/goals/shared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          thrust_area: thrustArea,
          title,
          description,
          uom,
          uom_direction: uomDirection,
          target,
          weightage: parseFloat(weightage),
          recipientIds: selectedRecipients.map((id) => parseInt(id, 10)),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess(`KPI assigned to ${data.clonedCount} employee(s).`);
        setSelectedRecipients([]);
        setTitle('');
        fetchAdminData();
      } else {
        setError(data.message || 'Could not push shared goal');
      }
    } catch {
      setError('Unable to reach the server.');
    }
  };

  const updateCycleSettings = async (patch) => {
    setError('');
    try {
      const response = await fetch('/api/cycles/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (response.ok) {
        const refresh = await fetch('/api/cycles/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCycleSettings(await refresh.json());
        setSuccess('Cycle settings saved.');
      } else {
        setError(data.message || 'Could not save cycle settings');
      }
    } catch {
      setError('Unable to reach the server.');
    }
  };

  const toggleRecipient = (id) => {
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const quarterlyChartRows =
    stats?.quarterlyStats?.map((q) => ({
      label: q.quarter,
      value: Number(q.employees_completed) || 0,
    })) || [];

  const managerChartRows =
    stats?.managerStats?.map((m) => ({
      label: m.manager_name,
      value: Number(m.approved_reporters) || 0,
      total: Number(m.total_reporters) || 0,
    })) || [];

  const statusChartRows =
    distribution?.status?.map((s) => ({
      label: `${s.quarter} · ${s.status}`,
      count: Number(s.count) || 0,
    })) || [];

  return (
    <div className="page">
      <PageHeader
        title="Administration"
        subtitle="Organization reports, shared KPIs, and governance"
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={fetchAdminData}>
              <RefreshCw size={16} /> Refresh
            </button>
            <button type="button" className="btn btn-primary" onClick={handleExportCSV}>
              <Download size={16} /> Export CSV
            </button>
          </>
        }
      />

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <section className="panel">
        <header className="panel-head">
          <h2>Cycle schedule (BRD §2.3)</h2>
          <p>May goal setting · Jul Q1 · Oct Q2 · Jan Q3 · Mar–Apr Q4/Annual</p>
        </header>
        <div className="panel-body">
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={cycleSettings?.enforcement_enabled !== false}
                onChange={(e) => updateCycleSettings({ enforcement_enabled: e.target.checked })}
              />
              Enforce BRD windows
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={cycleSettings?.demo_mode === true}
                onChange={(e) => updateCycleSettings({ demo_mode: e.target.checked })}
              />
              Demo mode (open all windows for testing)
            </label>
          </div>
          {cycleSettings?.status?.windows && (
            <table className="cycle-schedule-table">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Period</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cycleSettings.status.windows.map((w) => (
                  <tr key={w.id}>
                    <td>{w.label}</td>
                    <td>{w.period}</td>
                    <td className={w.isOpen ? 'cycle-open' : 'cycle-closed'}>{w.isOpen ? 'Open' : 'Closed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {stats && (
        <div className="stats-row">
          <StatCard label="Staff (emp. + mgr.)" value={stats.totalEmployees} />
          <StatCard label="Locked sheets" value={stats.lockedGoalSheets} hint={`${stats.phase1CompletionRate}% phase 1 complete`} />
          {stats.quarterlyStats?.map((q) => (
            <StatCard
              key={q.quarter}
              label={`${q.quarter} check-ins`}
              value={`${q.employees_completed} / ${stats.totalEmployees}`}
              hint={`Avg score ${q.average_score}%`}
            />
          ))}
        </div>
      )}

      <section className="analytics-charts">
        <h2 className="section-title" style={{ marginBottom: '0.75rem' }}>Reports &amp; charts</h2>
        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Live data from goal sheets and check-ins (Admin → Administration tab only).
        </p>
        {stats && (
          <section className="panel chart-panel" style={{ marginBottom: '1rem' }}>
            <header className="panel-head">
              <h2>Phase 1 — goal sheet completion</h2>
              <p>
                {stats.lockedGoalSheets} of {stats.totalEmployees} staff sheets locked (
                {stats.phase1CompletionRate}%)
              </p>
            </header>
            <div className="panel-body">
              <div className="bar-track" style={{ height: '14px' }}>
                <div className="bar-fill" style={{ width: `${Math.min(stats.phase1CompletionRate || 0, 100)}%` }} />
              </div>
            </div>
          </section>
        )}
        <div className="charts-grid">
          <BarChartPanel
            title="Goals by thrust area"
            subtitle="All goals in the system"
            rows={distribution?.thrustArea}
            labelKey="thrust_area"
            valueKey="count"
            emptyText="Add goals to see thrust-area breakdown."
          />
          <BarChartPanel
            title="Goals by unit of measure"
            rows={distribution?.uom}
            labelKey="uom"
            valueKey="count"
            emptyText="No goals recorded yet."
          />
          <BarChartPanel
            title="Check-ins by quarter"
            rows={quarterlyChartRows}
            labelKey="label"
            valueKey="value"
            emptyText="No quarterly check-ins yet."
          />
          <BarChartPanel
            title="Manager teams — approved"
            rows={managerChartRows}
            labelKey="label"
            valueKey="value"
            emptyText="No manager data."
          />
          <BarChartPanel
            title="Check-in status"
            rows={statusChartRows}
            labelKey="label"
            valueKey="count"
            emptyText="No check-in status data."
          />
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <header className="panel-head">
            <h2>Push shared KPI</h2>
            <p>Assign the same goal to multiple employees.</p>
          </header>
          <div className="panel-body">
            <form onSubmit={handlePushSharedGoal}>
              <div className="form-group">
                <label className="form-label">Thrust area</label>
                <input className="form-input" value={thrustArea} onChange={(e) => setThrustArea(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">UoM</label>
                  <select className="form-input" value={uomSelection} onChange={(e) => setUomSelection(e.target.value)}>
                    {UOM_OPTIONS.map((o) => (
                      <option key={toUomSelectionKey(o.value, o.direction)} value={toUomSelectionKey(o.value, o.direction)}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Target</label>
                  <input className="form-input" value={target} onChange={(e) => setTarget(e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Weightage (%)</label>
                <input type="number" className="form-input" min={10} max={100} value={weightage} onChange={(e) => setWeightage(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Recipients</label>
                <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem' }}>
                  {employees.map((emp) => (
                    <label key={emp.id} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                      <input type="checkbox" checked={selectedRecipients.includes(emp.id)} onChange={() => toggleRecipient(emp.id)} />
                      {emp.name}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Assign KPI</button>
            </form>
          </div>
        </section>

        <section className="panel" style={{ minWidth: 0 }}>
          <header className="panel-head">
            <h2>Exceptions &amp; audit</h2>
            <p>Unlock sheets or review change history.</p>
          </header>
          <div className="panel-body">
            <h3 className="section-title" style={{ fontSize: '0.875rem' }}>Unlock goal sheet</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Approver</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <strong>{emp.name}</strong>
                        <br />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.email}</span>
                      </td>
                      <td>{emp.role}</td>
                      <td>
                        {emp.role === 'Admin' ? 'Self (HR)' : emp.role === 'Manager' ? 'Admin (HR)' : emp.manager_name || '—'}
                      </td>
                      <td>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleUnlockGoals(emp.id, emp.name)}>
                          <Unlock size={14} /> Unlock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="section-title" style={{ marginTop: '1.5rem' }}>Audit trail</h2>
            {auditLogs.length === 0 ? (
              <p className="empty-state">No audit events recorded yet.</p>
            ) : (
              <div className="table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Goal</th>
                      <th>Action</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{new Date(log.changed_at).toLocaleString()}</td>
                        <td>{log.goal_title || '—'}</td>
                        <td><span className="badge badge-admin">{log.action}</span></td>
                        <td>{log.user_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminAnalytics;
