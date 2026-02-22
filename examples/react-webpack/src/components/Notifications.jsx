import BaseIcon from './BaseIcon';

const notifications = [
  {
    iconKey: 'comment',
    color: 'blue',
    title: 'New comment on your post',
    body: 'Alice left a comment: "Looks good, just one small fix needed."',
    time: '2 min ago',
  },
  {
    iconKey: 'check',
    color: 'green',
    title: 'Task completed',
    body: 'Your task "Update icon set" was marked as done.',
    time: '15 min ago',
  },
  {
    iconKey: 'filter',
    color: 'yellow',
    title: 'New filter saved',
    body: 'Your custom filter "Open tasks" has been saved.',
    time: '1 hour ago',
  },
  {
    iconKey: 'delete',
    color: 'red',
    title: 'Item deleted',
    body: 'Draft "Old notes" was permanently deleted.',
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
