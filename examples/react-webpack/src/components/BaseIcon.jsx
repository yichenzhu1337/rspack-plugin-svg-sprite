/**
 * BaseIcon — reusable SVG icon component
 *
 * Usage:
 *   import approvedIcon from './icons/approved.svg';
 *   <BaseIcon icon={approvedIcon} size={24} />
 */
export default function BaseIcon({ icon, size = 16, className = '', title, onClick }) {
  const sym = icon.default || icon;
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox={sym.viewBox}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {title && <title>{title}</title>}
      <use xlinkHref={sym.url} />
    </svg>
  );
}
