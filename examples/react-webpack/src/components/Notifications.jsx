import { useState } from 'react';
import BaseIcon from './BaseIcon';

const initialNotifications = [
  {
    id: 'notif-comment',
    iconKey: 'comment',
    color: 'blue',
    title: 'New comment on your report',
    body: 'Alice left a comment: "Looks good, just one small fix needed."',
    time: '2 min ago',
  },
  {
    id: 'notif-approved',
    iconKey: 'approved',
    color: 'green',
    title: 'Expense approved',
    body: 'Your travel expense report was approved by the finance team.',
    time: '15 min ago',
  },
  {
    id: 'notif-filter',
    iconKey: 'filter',
    color: 'yellow',
    title: 'New filter saved',
    body: 'Your custom filter "Q4 Expenses > $500" has been saved.',
    time: '1 hour ago',
  },
  {
    id: 'notif-delete',
    iconKey: 'delete',
    color: 'red',
    title: 'Item deleted',
    body: 'Draft report "Nov Travel" was permanently deleted.',
    time: '3 hours ago',
  },
];

export default function Notifications({ iconMap, dismissIcon }) {
  const [items, setItems] = useState(initialNotifications);

  const dismiss = (id) => setItems((prev) => prev.filter((n) => n.id !== id));

  if (items.length === 0) {
    return (
      <section className="section">
        <h2>Notification Cards</h2>
        <p className="empty-state">All caught up! No notifications.</p>
      </section>
    );
  }

  return (
    <section className="section">
      <h2>Notification Cards</h2>
      <div className="notification-list" role="list" aria-label="Notifications">
        {items.map((n) => (
          <div className="notification" key={n.id} role="listitem">
            <div className={`notification-icon ${n.color}`}>
              <BaseIcon icon={iconMap[n.iconKey]} size={18} />
            </div>
            <div className="notification-body">
              <h4>{n.title}</h4>
              <p>{n.body}</p>
            </div>
            <span className="notification-time">{n.time}</span>
            {dismissIcon && (
              <button
                className="notification-dismiss"
                onClick={() => dismiss(n.id)}
                aria-label={`Dismiss: ${n.title}`}
              >
                <BaseIcon icon={dismissIcon} size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
