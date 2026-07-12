import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'accent';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    primary: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    error: 'bg-red-500/15 text-red-400 border border-red-500/30',
    neutral: 'bg-gray-800 text-gray-300 border border-gray-700',
    accent: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  }[variant];

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full ${variantStyles} ${sizeStyles} ${className}`}
    >
      {children}
    </span>
  );
};
