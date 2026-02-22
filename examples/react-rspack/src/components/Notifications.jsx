import BaseIcon from './BaseIcon';

const notifications = [
  {
    iconKey: 'mail',
    color: 'blue',
    title: 'New message from Alice',
    body: 'Hey, can you review the latest pull request when you get a chance?',
    time: '2 min ago',
  },
  {
    iconKey: 'user',
    color: 'green',
    title: 'New team member',
    body: 'Bob has joined the Engineering team.',
    time: '15 min ago',
  },
  {
    iconKey: 'bell',
    color: 'yellow',
    title: 'Deployment complete',
    body: 'v2.4.1 was successfully deployed to production.',
    time: '1 hour ago',
  },
  {
    iconKey: 'heart',
    color: 'red',
    title: '3 new likes on your post',
    body: 'Your update about SVG sprites is getting traction!',
    time: '3 hours ago',
  },
];

export default function Notifications({ iconMap }) {
  return (
    <section className="section">
      <h2>Notification Cards</h2>
      <div className="notification-list">
        {notifications.map((n, i) => (
          <div className="notification" key={i}>
            <div className={`notification-icon ${n.color}`}>
              <BaseIcon icon={iconMap[n.iconKey]} size={18} />
            </div>
            <div className="notification-body">
              <h4>{n.title}</h4>
              <p>{n.body}</p>
            </div>
            <span className="notification-time">{n.time}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
