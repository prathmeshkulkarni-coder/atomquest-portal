import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import Alert from '../components/Alert';

const DEMO_ACCOUNTS = [
  { label: 'Employee', email: 'employee@atomquest.com' },
  { label: 'Manager', email: 'manager@atomquest.com' },
  { label: 'Admin', email: 'admin@atomquest.com' },
];

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError('');
  };

  return (
    <div className="login-layout">
      <aside className="login-brand">
        <h1>Goal setting &amp; tracking</h1>
        <p>
          Plan objectives, align with your manager, and record quarterly progress in one place.
        </p>
        <div className="login-features">
          <div className="login-feature">
            <span className="login-feature-dot" />
            <span>Draft goals with weightage validation (max 8, min 10%, total 100%)</span>
          </div>
          <div className="login-feature">
            <span className="login-feature-dot" />
            <span>Manager approval workflow with inline edits</span>
          </div>
          <div className="login-feature">
            <span className="login-feature-dot" />
            <span>Quarterly check-ins with auto-calculated progress scores</span>
          </div>
        </div>
      </aside>

      <div className="login-form-side">
        <div className="login-card">
          <h2>Welcome back</h2>
          <p className="subtitle">Sign in to your workspace</p>

          {error && <Alert type="error">{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              <LogIn size={16} />
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="demo-accounts">
            <p>Quick access (demo)</p>
            <div className="demo-grid">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fillDemo(a.email)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
