import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: React.ReactNode;
}

export default function Select({ label, error, className = '', children, ...props }: SelectProps) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <select className={`input ${error ? 'border-red-400 focus:ring-red-500' : ''} ${className}`} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
