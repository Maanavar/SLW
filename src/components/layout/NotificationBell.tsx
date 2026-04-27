import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification } from '@/lib/notificationUtils';
import './NotificationBell.css';

function NotificationRow({
  notification,
  onNavigate,
  onDismiss,
}: {
  notification: AppNotification;
  onNavigate: (link: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className={`notif-row notif-row--${notification.type}`}>
      <div className="notif-row-bar" aria-hidden="true" />
      <div className="notif-row-body">
        <span className="notif-row-title">{notification.title}</span>
        <span className="notif-row-text">{notification.body}</span>
      </div>
      <div className="notif-row-actions">
        <button
          type="button"
          className="notif-view-btn"
          onClick={() => onNavigate(notification.link)}
          title="Go to page"
        >
          View
        </button>
        {notification.dismissible && (
          <button
            type="button"
            className="notif-dismiss-btn"
            onClick={() => onDismiss(notification.id)}
            title="Dismiss"
            aria-label="Dismiss notification"
          >
            <Icon name="x" width={12} height={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, count, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleNavigate = (link: string) => {
    setOpen(false);
    navigate(link);
  };

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button
        type="button"
        className="top-icon-btn notif-bell-btn"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label={count > 0 ? `${count} notifications` : 'No notifications'}
        aria-expanded={open}
      >
        <Icon name="bell" width={16} height={16} />
        {count > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="region" aria-label="Notifications">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            {count > 0 && <span className="notif-panel-count">{count}</span>}
          </div>

          <div className="notif-panel-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <Icon name="check" width={20} height={20} />
                <span>All caught up</span>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onNavigate={handleNavigate}
                  onDismiss={dismiss}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
