import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';

const NotificationBell = ({ token }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications || []);
        setUnread(data.unreadCount || 0);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const markRead = async (id) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  };

  const markAll = async () => {
    await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  };

  return (
    <div ref={ref} className="notif-wrap">
      <button
        type="button"
        className="btn btn-ghost btn-icon notif-btn"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <p className="notif-empty">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${n.is_read ? '' : 'notif-item--unread'}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    markRead(n.id);
                    if (n.deep_link) window.location.href = n.deep_link;
                  }}
                >
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                  <time>{new Date(n.created_at).toLocaleString()}</time>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
