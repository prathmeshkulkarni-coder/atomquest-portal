import React, { useState, useEffect } from 'react';
import { CheckCircle, RotateCcw, Send, Plus } from 'lucide-react';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import QuarterTabs from '../components/QuarterTabs';
import { UOM_OPTIONS, parseUomSelection, toUomSelectionKey } from '../constants/uom';
import { filterReviewableUsers, getManagerSheetSubtitle } from '../constants/approval';
import { parseGoalsResponse } from '../constants/goalsApi';

const THRUST_AREAS = [
  'Technology',
  'Sales & Marketing',
  'Customer Success',
  'Finance',
  'Operations',
  'Quality Assurance',
];

const ManagerReview = ({ token, user }) => {
  const [hierarchy, setHierarchy] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empGoals, setEmpGoals] = useState([]);
  const [empSheetStatus, setEmpSheetStatus] = useState('draft');
  const [checkins, setCheckins] = useState({});
  const [editedTargets, setEditedTargets] = useState({});
  const [editedWeightages, setEditedWeightages] = useState({});
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
  const [managerComments, setManagerComments] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cycleStatus, setCycleStatus] = useState(null);
  const [thrustArea, setThrustArea] = useState('Technology');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uomSelection, setUomSelection] = useState('Numeric|Min');
  const [target, setTarget] = useState('');
  const [weightage, setWeightage] = useState(15);

  const { uom, uom_direction: uomDirection } = parseUomSelection(uomSelection);
  const goalSettingOpen = cycleStatus?.windows?.find((w) => w.id === 'GOAL_SETTING')?.isOpen ?? true;
  const sheetApproved = empSheetStatus === 'approved';
  const sheetPending = empSheetStatus === 'submitted';

  useEffect(() => {
    fetchTeam();
    fetch('/api/cycles/status', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setCycleStatus)
      .catch(() => {});
  }, [token]);

  const fetchTeam = async () => {
    try {
      const response = await fetch('/api/auth/hierarchy', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        const managed = filterReviewableUsers(data, user);
        setHierarchy(managed);
        if (managed.length > 0) handleSelectEmployee(managed[0]);
      }
    } catch {
      setError('Failed to load team.');
    }
  };

  const handleSelectEmployee = async (emp, { keepAlerts = false } = {}) => {
    setSelectedEmp(emp);
    if (!keepAlerts) {
      setError('');
      setSuccess('');
    }
    try {
      const response = await fetch(`/api/goals?userId=${emp.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Failed to load goals');
        return;
      }
      const { goals: goalList, sheetStatus } = parseGoalsResponse(data);
      setEmpGoals(goalList);
      setEmpSheetStatus(sheetStatus);
      const targets = {};
      const weights = {};
      goalList.forEach((g) => {
        targets[g.id] = g.target;
        weights[g.id] = g.weightage;
      });
      setEditedTargets(targets);
      setEditedWeightages(weights);
      const checkinsMap = {};
      const comments = {};
      await Promise.all(
        goalList.map(async (goal) => {
          const chRes = await fetch(`/api/checkins/${goal.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const chData = chRes.ok ? await chRes.json() : [];
          checkinsMap[goal.id] = chData;
          comments[goal.id] = chData.find((c) => c.quarter === selectedQuarter)?.manager_comment || '';
        })
      );
      setCheckins(checkinsMap);
      setManagerComments(comments);
    } catch {
      setError('Failed to load employee goals.');
    }
  };

  useEffect(() => {
    if (!empGoals.length) return;
    const comments = {};
    empGoals.forEach((goal) => {
      const current = (checkins[goal.id] || []).find((c) => c.quarter === selectedQuarter);
      comments[goal.id] = current?.manager_comment || '';
    });
    setManagerComments(comments);
  }, [selectedQuarter, checkins, empGoals]);

  const handleReviewAction = async (action) => {
    if (!selectedEmp) return;
    if (action === 'APPROVE' && !weightOk) {
      setError(`Weightage must total 100% before approval (current: ${totalWeightage}%).`);
      setSuccess('');
      return;
    }
    setError('');
    setSuccess('');
    const goalsUpdates = empGoals.map((g) => ({
      id: g.id,
      target: editedTargets[g.id],
      weightage: parseFloat(editedWeightages[g.id]),
    }));
    try {
      const response = await fetch('/api/goals/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employeeId: selectedEmp.id, action, goalsUpdates }),
      });
      const data = await response.json();
      if (response.ok) {
        const defaultMsg =
          action === 'APPROVE'
            ? `${selectedEmp.name}'s goal sheet was approved and locked.`
            : `${selectedEmp.name}'s sheet was returned for rework.`;
        await handleSelectEmployee(selectedEmp, { keepAlerts: true });
        if (data.sheetStatus) setEmpSheetStatus(data.sheetStatus);
        setSuccess(data.message || defaultMsg);
      } else {
        setError(data.message || 'Action failed');
      }
    } catch {
      setError('Unable to reach the server.');
    }
  };

  const handleAddGoalForEmployee = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return;
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
          userId: selectedEmp.id,
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
        const msg = `Goal added to ${selectedEmp.name}'s sheet.`;
        setTitle('');
        setDescription('');
        setTarget('');
        await handleSelectEmployee(selectedEmp, { keepAlerts: true });
        setSuccess(msg);
      } else {
        setError(data.message || 'Could not add goal');
      }
    } catch {
      setError('Unable to reach the server.');
    }
  };

  const handleSaveComment = async (goalId) => {
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/checkins/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          goalId,
          quarter: selectedQuarter,
          manager_comment: managerComments[goalId],
        }),
      });
      if (response.ok) {
        setSuccess('Comment saved.');
        const chRes = await fetch(`/api/checkins/${goalId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (chRes.ok) setCheckins({ ...checkins, [goalId]: await chRes.json() });
      } else {
        const data = await response.json();
        setError(data.message || 'Could not save comment');
      }
    } catch {
      setError('Unable to reach the server.');
    }
  };

  const totalWeightage = empGoals.reduce(
    (sum, g) => sum + parseFloat(editedWeightages[g.id] ?? g.weightage),
    0
  );
  const weightOk = Math.abs(totalWeightage - 100) < 0.01;

  return (
    <div className="page">
      <PageHeader
        title={user.role === 'Admin' ? 'Team & manager review' : 'Team review'}
        subtitle={
          user.role === 'Admin'
            ? 'Approve employee and manager goal sheets; record quarterly feedback.'
            : 'Approve goal sheets and record quarterly check-in feedback.'
        }
        actions={
          selectedEmp ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => handleReviewAction('REWORK')}>
                <RotateCcw size={16} /> Return for rework
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleReviewAction('APPROVE')}
                disabled={!weightOk || sheetApproved || !sheetPending}
                title={
                  sheetApproved
                    ? 'Already approved'
                    : !sheetPending
                      ? 'Employee has not submitted yet'
                      : !weightOk
                        ? 'Weightage must total 100%'
                        : 'Approve and lock goal sheet'
                }
              >
                <CheckCircle size={16} /> Approve
              </button>
            </>
          ) : null
        }
      />

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div className="dashboard-grid">
        <aside className="panel">
          <header className="panel-head">
            <h2>{user.role === 'Admin' ? 'Staff' : 'Direct reports'}</h2>
            <p>{hierarchy.length} to review</p>
          </header>
          <div className="panel-body">
            {hierarchy.length === 0 ? (
              <p className="empty-state">No employees assigned.</p>
            ) : (
              <div className="team-list">
                {hierarchy.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    className={`team-item ${selectedEmp?.id === emp.id ? 'team-item--active' : ''}`}
                    onClick={() => handleSelectEmployee(emp)}
                  >
                    <span className="team-item-name">
                      {emp.name}
                      <span className={`badge badge-${emp.role === 'Manager' ? 'manager' : 'employee'}`} style={{ marginLeft: '0.35rem' }}>
                        {emp.role}
                      </span>
                    </span>
                    <span className="team-item-email">{emp.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="panel" style={{ minWidth: 0 }}>
          <header className="panel-head">
            <h2>{selectedEmp ? `${selectedEmp.name}'s goals` : 'Goal review'}</h2>
            <p>
              {selectedEmp
                ? getManagerSheetSubtitle(empSheetStatus, totalWeightage, weightOk)
                : 'Choose someone from the list'}
            </p>
          </header>
          <div className="panel-body">
            {!selectedEmp ? (
              <div className="empty-state">
                <h3>No employee selected</h3>
                <p>Pick a direct report from the sidebar to begin.</p>
              </div>
            ) : (
              <>
                {sheetPending && (
                  <Alert type="info">This sheet was submitted and is waiting for your approval.</Alert>
                )}

                {!weightOk && sheetPending && (
                  <Alert type="error">
                    Weightage must total 100% before approval (current: {totalWeightage}%)
                  </Alert>
                )}

                {!sheetApproved && !goalSettingOpen && (
                  <Alert type="error">Goal Setting window is closed (May 1 – Jun 30).</Alert>
                )}

                {!sheetApproved && !sheetPending && goalSettingOpen && (
                  <form className="manager-add-goal" onSubmit={handleAddGoalForEmployee}>
                    <h3 className="section-title">Add goal for {selectedEmp.name}</h3>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Thrust area</label>
                        <select className="form-input" value={thrustArea} onChange={(e) => setThrustArea(e.target.value)}>
                          {THRUST_AREAS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Title</label>
                        <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
                      </div>
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
                        <input
                          type={uom === 'Timeline' ? 'date' : 'text'}
                          className="form-input"
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Weight %</label>
                        <input
                          type="number"
                          className="form-input"
                          min={10}
                          value={weightage}
                          onChange={(e) => setWeightage(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ alignSelf: 'end' }}>
                        <button type="submit" className="btn btn-primary">
                          <Plus size={16} /> Add goal
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                <QuarterTabs value={selectedQuarter} onChange={setSelectedQuarter} />

                {empGoals.length === 0 ? (
                  <p className="empty-state">No goals yet — add goals above or ask the employee to draft their sheet.</p>
                ) : (
                  <div className="table-wrap" style={{ marginTop: '1rem' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Goal</th>
                          <th>UoM</th>
                          <th>Target</th>
                          <th>Weight</th>
                          <th>Actual</th>
                          <th>Status</th>
                          <th>Score</th>
                          <th>Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empGoals.map((goal) => {
                          const current = (checkins[goal.id] || []).find((c) => c.quarter === selectedQuarter);
                          const isClone = goal.is_shared && goal.parent_goal_id !== null;
                          return (
                            <tr key={goal.id}>
                              <td>
                                <strong>{goal.title}</strong>
                                <br />
                                <span className="badge badge-employee">{goal.thrust_area}</span>
                                {goal.is_shared && <span className="tag">Shared</span>}
                              </td>
                              <td>{goal.uom}</td>
                              <td>
                                <input
                                  className="form-input"
                                  style={{ width: '100px', padding: '0.35rem' }}
                                  value={editedTargets[goal.id] ?? goal.target}
                                  disabled={isClone}
                                  onChange={(e) => setEditedTargets({ ...editedTargets, [goal.id]: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ width: '70px', padding: '0.35rem' }}
                                  value={editedWeightages[goal.id] ?? goal.weightage}
                                  onChange={(e) => setEditedWeightages({ ...editedWeightages, [goal.id]: e.target.value })}
                                />
                              </td>
                              <td>{current?.actual_achievement ?? '—'}</td>
                              <td>{current?.status ?? 'Not Started'}</td>
                              <td>{current ? `${current.progress_score}%` : '—'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                  <textarea
                                    className="form-input"
                                    rows={2}
                                    style={{ width: '160px', fontSize: '0.8125rem', resize: 'none' }}
                                    placeholder="Check-in comment"
                                    value={managerComments[goal.id] || ''}
                                    onChange={(e) => setManagerComments({ ...managerComments, [goal.id]: e.target.value })}
                                  />
                                  <button type="button" className="btn btn-secondary btn-icon" onClick={() => handleSaveComment(goal.id)}>
                                    <Send size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ManagerReview;
