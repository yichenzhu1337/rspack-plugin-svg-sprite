/**
 * BaseIcon — reusable SVG icon component
 *
 * Usage:
 *   import homeIcon from './icons/home.svg';
 *   <BaseIcon icon={homeIcon} size={24} />
 */
export default function BaseIcon({ icon, size = 16, className = '', title, onClick }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox={icon.viewBox}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {title && <title>{title}</title>}
      <use xlinkHref={icon.url} />
    </svg>
  );
}
