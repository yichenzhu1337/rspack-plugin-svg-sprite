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
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      style={onClick ? { cursor: 'pointer' } : undefined}
      aria-hidden={!title}
    >
      {title && <title>{title}</title>}
      <use href={sym.url} />
    </svg>
  );
}
