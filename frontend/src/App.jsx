import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ManagerReview from './pages/ManagerReview';
import AdminAnalytics from './pages/AdminAnalytics';
import { LogOut, Sun, Moon } from 'lucide-react';
import CycleBanner from './components/CycleBanner';

const initials = (name) =>
  name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
      return null;
    }
  });
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [activeTab, setActiveTab] = useState('Employee');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLogin = async (email, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (response.ok) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setActiveTab(
        data.user.role === 'Admin' ? 'Admin' : data.user.role === 'Manager' ? 'Manager' : 'Employee'
      );
    } else {
      throw new Error(data.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const renderContent = () => {
    if (!user) return null;
    if (activeTab === 'Admin' && user.role === 'Admin') return <AdminAnalytics token={token} />;
    if (activeTab === 'Manager' && (user.role === 'Manager' || user.role === 'Admin'))
      return <ManagerReview token={token} user={user} />;
    return <EmployeeDashboard token={token} user={user} />;
  };

  const navItems = [
    { id: 'Employee', label: 'My goals', show: true },
    { id: 'Manager', label: 'Team review', show: user?.role === 'Manager' || user?.role === 'Admin' },
    { id: 'Admin', label: 'Administration', show: user?.role === 'Admin' },
  ].filter((n) => n.show);

  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="top-nav-inner">
          <div className="brand">
            <span className="brand-mark">GQ</span>
            <span>Goal Portal</span>
          </div>

          {navItems.length > 1 && (
            <nav className="nav-tabs" aria-label="Main">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-tab ${activeTab === item.id ? 'nav-tab--active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          <div className="nav-actions">
            <div className="user-chip">
              <span className="user-avatar">{initials(user.name)}</span>
              <span className="user-chip-text">
                <strong>{user.name}</strong>
                <span>{user.role}</span>
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <CycleBanner token={token} />
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
