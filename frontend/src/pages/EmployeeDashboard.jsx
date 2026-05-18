import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  Save,
  FileText,
  Target,
  Scale,
  Inbox,
} from 'lucide-react';
import Alert from '../components/Alert';
import StatCard from '../components/StatCard';
import QuarterTabs from '../components/QuarterTabs';
import PageHeader from '../components/PageHeader';
import { UOM_OPTIONS, parseUomSelection, toUomSelectionKey, formatUom } from '../constants/uom';
import {
  getSubmitSuccessMessage,
  getLockedHint,
  getLockedPanelText,
  getSheetStatusLabel,
  getCheckinSubtitle,
} from '../constants/approval';
import { parseGoalsResponse } from '../constants/goalsApi';

const THRUST_AREAS = [
  'Technology',
  'Sales & Marketing',
  'Customer Success',
  'Finance',
  'Operations',
  'Quality Assurance',
];

const EmployeeDashboard = ({ token, user }) => {
  const [goals, setGoals] = useState([]);
  const [sheetStatus, setSheetStatus] = useState('draft');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cycleStatus, setCycleStatus] = useState(null);
  const [thrustArea, setThrustArea] = useState('Technology');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uomSelection, setUomSelection] = useState('Numeric|Min');
  const [target, setTarget] = useState('');
  const [weightage, setWeightage] = useState(15);
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
  const [actualAchievements, setActualAchievements] = useState({});
  const [statuses, setStatuses] = useState({});
  const [checkins, setCheckins] = useState({});

  useEffect(() => {
    fetchGoals();
    fetch('/api/cycles/status', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setCycleStatus)
      .catch(() => {});
  }, [user, token]);

  const goalSettingOpen = cycleStatus?.windows?.find((w) => w.id === 'GOAL_SETTING')?.isOpen ?? true;
  const checkinOpen = (quarter) => {
    const win = cycleStatus?.windows?.find(
      (w) => w.quarter === quarter || w.quarters?.includes?.(quarter)
    );
    return win?.isOpen ?? true;
  };
  const { uom, uom_direction: uomDirection } = parseUomSelection(uomSelection);

  const fetchGoals = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/goals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Failed to load goals');
        return;
      }
      const { goals: goalList, sheetStatus: status } = parseGoalsResponse(data);
      setGoals(goalList);
      setSheetStatus(status);
      const initialActuals = {};
      const initialStatuses = {};
      const checkinsMap = {};
      await Promise.all(
        goalList.map(async (goal) => {
          const chRes = await fetch(`/api/checkins/${goal.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const chData = chRes.ok ? await chRes.json() : [];
          checkinsMap[goal.id] = chData;
          const current = chData.find((c) => c.quarter === selectedQuarter);
          initialActuals[goal.id] = current?.actual_achievement || '';
          initialStatuses[goal.id] = current?.status || 'Not Started';
        })
      );
      setCheckins(checkinsMap);
      setActualAchievements(initialActuals);
      setStatuses(initialStatuses);
    } catch {
      setError('Unable to reach the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!goals.length) return;
    const initialActuals = {};
    const initialStatuses = {};
    goals.forEach((goal) => {
      const current = (checkins[goal.id] || []).find((c) => c.quarter === selectedQuarter);
      initialActuals[goal.id] = current?.actual_achievement || '';
      initialStatuses[goal.id] = current?.status || 'Not Started';
    });
    setActualAchievements(initialActuals);
    setStatuses(initialStatuses);
  }, [selectedQuarter, checkins, goals]);

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!title || !target) {
      setError('Title and target are required.');
      return;
    }
    try {
      const response = await fetch('/api/goals', {
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
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setGoals([...goals, data]);
        setTitle('');
        setDescription('');
        setTarget('');
        setWeightage(15);
        setSuccess('Goal added to your sheet.');
        fetchGoals();
      } else {
        setError(data.message || 'Could not create goal');
      }
    } catch {
      setError('Unable to reach the server.');
    }
  };

  const handleDeleteGoal = async (id, isSharedKpi = false) => {
    const msg = isSharedKpi
      ? 'Remove this admin-assigned KPI from your goal sheet?'
      : 'Remove this goal from your sheet?';
    if (!window.confirm(msg)) return;
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/goals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setGoals(goals.filter((g) => g.id !== id));
        setSuccess('Goal removed.');
      } else {
        const data = await response.json();
        setError(data.message || 'Could not delete goal');
      }
    } catch {
      setError('Unable to reach the server.');
    }
  };

  const handleSubmitGoalSheet = async () => {
    setError('');
    setSuccess('');
    if (!goals.length) {
      setError('Add at least one goal before submitting.');
      return;
    }
    const total = goals.reduce((sum, g) => sum + parseFloat(g.weightage), 0);
    if (Math.abs(total - 100) > 0.01) {
      setError(`Total weightage must equal 100%. Current: ${total}%`);
      return;
    }
    try {
      const response = await fetch('/api/goals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        const data = await response.json();
        setGoals(goals.map((g) => ({ ...g, is_locked: true })));
        setSheetStatus(data.sheetStatus || 'submitted');
        setSuccess(data.message || getSubmitSuccessMessage(user.role));
      } else {
        const data = await response.json();
        setError(data.message || 'Submission failed');
      }
    } catch {
      setError('Unable to reach the server.');
    }
  };

  const handleLogCheckin = async (goalId) => {
    setError('');
    setSuccess('');
    const actual = actualAchievements[goalId];
    if (actual === undefined || actual === '') {
      setError('Enter an actual achievement value.');
      return;
    }
    try {
      const response = await fetch('/api/checkins/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          goalId,
          quarter: selectedQuarter,
          actual_achievement: actual,
          status: statuses[goalId] || 'Not Started',
        }),
      });
      if (response.ok) {
        setSuccess(`${selectedQuarter} progress saved.`);
        const chRes = await fetch(`/api/checkins/${goalId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (chRes.ok) setCheckins({ ...checkins, [goalId]: await chRes.json() });
      } else {
        const data = await response.json();
        setError(data.message || 'Could not save check-in');
      }
    } catch {
      setError('Unable to reach the server.');
    }
  };

  const totalWeightage = goals.reduce((sum, g) => sum + parseFloat(g.weightage), 0);
  const isLocked = sheetStatus === 'submitted' || sheetStatus === 'approved';
  const canEditGoals = sheetStatus === 'draft';
  const weightOk = Math.abs(totalWeightage - 100) < 0.01;
  // Admin may delete even on locked HR sheets; employees/managers only while draft
  const showActionsColumn = canEditGoals || user.role === 'Admin';

  const canDeleteGoal = (goal) => {
    if (user.role === 'Admin') return true;
    if (!canEditGoals) return false;
    if (goal.is_shared && goal.parent_goal_id === null) return false;
    return true;
  };

  return (
    <div className="page">
      <PageHeader
        title="My goal sheet"
        subtitle={`FY 2026 · ${user.name}`}
        actions={
          canEditGoals && goals.length > 0 ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmitGoalSheet}
              disabled={!weightOk || !goalSettingOpen}
              title={!goalSettingOpen ? 'Goal Setting window is closed (BRD schedule)' : ''}
            >
              <CheckCircle2 size={16} /> Submit for approval
            </button>
          ) : null
        }
      />

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}
      {!goalSettingOpen && canEditGoals && (
        <Alert type="error">Goal Setting window is closed. Goal edits resume May 1 – Jun 30 (or enable Demo mode in Admin).</Alert>
      )}
      {isLocked && !checkinOpen(selectedQuarter) && (
        <Alert type="error">{selectedQuarter} check-in window is closed per the BRD quarterly schedule.</Alert>
      )}

      <div className="stats-row">
        <StatCard
          label="Sheet status"
          value={getSheetStatusLabel(sheetStatus)}
          hint={getLockedHint(user.role, sheetStatus)}
          icon={FileText}
        />
        <StatCard label="Goals" value={`${goals.length} / 8`} hint="Maximum per employee" icon={Target} />
        <StatCard
          label="Weightage"
          value={`${totalWeightage}%`}
          hint={weightOk ? 'Ready to submit' : 'Must total 100%'}
          icon={Scale}
          accent={weightOk ? 'success' : undefined}
          meter={totalWeightage}
        />
      </div>

      <div className="dashboard-grid">
        {canEditGoals ? (
          <section className="panel">
            <header className="panel-head">
              <h2>Add a goal</h2>
              <p>Each goal needs at least 10% weight. Total must reach 100%.</p>
            </header>
            <div className="panel-body">
              <form onSubmit={handleCreateGoal}>
                <div className="form-group">
                  <label className="form-label">Thrust area</label>
                  <select className="form-input" value={thrustArea} onChange={(e) => setThrustArea(e.target.value)}>
                    {THRUST_AREAS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Goal title</label>
                  <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit of measure (BRD Min / Max)</label>
                  <select
                    className="form-input"
                    value={uomSelection}
                    onChange={(e) => setUomSelection(e.target.value)}
                  >
                    {UOM_OPTIONS.map((o) => (
                      <option key={toUomSelectionKey(o.value, o.direction)} value={toUomSelectionKey(o.value, o.direction)}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Target</label>
                  <input
                    type={uom === 'Timeline' ? 'date' : 'text'}
                    className="form-input"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Weightage (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    min={10}
                    max={100}
                    value={weightage}
                    onChange={(e) => setWeightage(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block" disabled={!goalSettingOpen}>
                  <Plus size={16} /> Add to sheet
                </button>
              </form>
            </div>
          </section>
        ) : (
          <aside className="panel">
            <div className="panel-body lock-card">
              <div className="lock-card-icon">
                <Lock size={22} />
              </div>
              <h2 className="section-title">Sheet locked</h2>
              <p>{getLockedPanelText(user.role)}</p>
            </div>
          </aside>
        )}

        <section className="panel">
          <header className="panel-head">
            <h2>Goals &amp; progress</h2>
            <p>{getCheckinSubtitle(user.role, sheetStatus)}</p>
          </header>
          <div className="panel-body">
            <QuarterTabs
              value={selectedQuarter}
              onChange={setSelectedQuarter}
              labels={{ Q1: 'Q1', Q2: 'Q2', Q3: 'Q3', Q4: 'Q4 / Annual' }}
            />

            {loading ? (
              <div className="spinner" aria-label="Loading" />
            ) : goals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Inbox size={22} />
                </div>
                <h3>No goals yet</h3>
                <p>Add your first goal using the form on the left, then submit when weightage totals 100%.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Goal</th>
                      <th>UoM</th>
                      <th>Target</th>
                      <th>Weight</th>
                      <th>{selectedQuarter} actual</th>
                      <th>Status</th>
                      <th>Score</th>
                      {showActionsColumn && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {goals.map((goal) => {
                      const goalCheckins = checkins[goal.id] || [];
                      const currentCheckin = goalCheckins.find((c) => c.quarter === selectedQuarter);
                      const isClone = goal.is_shared && goal.parent_goal_id !== null;
                      const score = currentCheckin?.progress_score;

                      return (
                        <tr key={goal.id}>
                          <td>
                            <div className="goal-cell-title">{goal.title}</div>
                            <div className="goal-cell-meta">
                              <span className="badge badge-employee">{goal.thrust_area}</span>
                              {goal.is_shared && <span className="tag">Shared KPI</span>}
                            </div>
                          </td>
                          <td>{formatUom(goal.uom, goal.uom_direction)}</td>
                          <td>{goal.target}</td>
                          <td>
                            <strong>{goal.weightage}%</strong>
                          </td>
                          <td>
                            {isLocked ? (
                              <div className="input-group">
                                <input
                                  type={goal.uom === 'Timeline' ? 'date' : 'text'}
                                  className="form-input form-input--sm"
                                  value={actualAchievements[goal.id] || ''}
                                  disabled={isClone}
                                  onChange={(e) =>
                                    setActualAchievements({ ...actualAchievements, [goal.id]: e.target.value })
                                  }
                                />
                                {!isClone && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-icon"
                                    onClick={() => handleLogCheckin(goal.id)}
                                    disabled={!checkinOpen(selectedQuarter)}
                                    title="Save"
                                  >
                                    <Save size={14} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted">After submit</span>
                            )}
                          </td>
                          <td>
                            {isLocked ? (
                              <select
                                className="form-input form-input--sm"
                                value={statuses[goal.id] || 'Not Started'}
                                disabled={isClone}
                                onChange={(e) => setStatuses({ ...statuses, [goal.id]: e.target.value })}
                              >
                                <option>Not Started</option>
                                <option>On Track</option>
                                <option>Completed</option>
                              </select>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {score != null ? (
                              <span className={`score-badge ${Number(score) >= 100 ? 'score-badge--high' : ''}`}>
                                {score}%
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          {showActionsColumn && (
                            <td className="actions-cell">
                              {canDeleteGoal(goal) ? (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm goal-delete-btn"
                                  onClick={() => handleDeleteGoal(goal.id, isClone)}
                                  title={isClone ? 'Remove shared KPI copy' : 'Delete goal'}
                                  aria-label={isClone ? 'Remove shared KPI' : 'Delete goal'}
                                >
                                  <Trash2 size={15} />
                                  <span>Delete</span>
                                </button>
                              ) : (
                                <span className="text-muted" title="Unlock sheet to remove goals">
                                  —
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
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

export default EmployeeDashboard;
