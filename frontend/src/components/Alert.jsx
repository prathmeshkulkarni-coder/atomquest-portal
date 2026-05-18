export default function Alert({ type = 'info', children }) {
  if (!children) return null;
  const variant = ['error', 'success', 'info'].includes(type) ? type : 'info';
  return (
    <div className={`alert alert-${variant}`} role="alert">
      {children}
    </div>
  );
}
