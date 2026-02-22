import { useState } from 'react';
import BaseIcon from './BaseIcon';

const initialNotifications = [
  {
    id: 'notif-mail',
    iconKey: 'mail',
    color: 'blue',
    title: 'New message from Alice',
    body: 'Hey, can you review the latest pull request when you get a chance?',
    time: '2 min ago',
  },
  {
    id: 'notif-user',
    iconKey: 'user',
    color: 'green',
    title: 'New team member',
    body: 'Bob has joined the Engineering team.',
    time: '15 min ago',
  },
  {
    id: 'notif-bell',
    iconKey: 'bell',
    color: 'yellow',
    title: 'Deployment complete',
    body: 'v2.4.1 was successfully deployed to production.',
    time: '1 hour ago',
  },
  {
    id: 'notif-heart',
    iconKey: 'heart',
    color: 'red',
    title: '3 new likes on your post',
    body: 'Your update about SVG sprites is getting traction!',
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
