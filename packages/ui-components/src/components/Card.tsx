import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'glass',
  padding = 'md',
  className = '',
  ...props
}) => {
  const variantStyles = {
    default: 'bg-gray-900 border border-gray-800 shadow-md',
    glass: 'bg-gray-900/80 backdrop-blur-md border border-white/10 shadow-lg',
    bordered: 'bg-transparent border border-gray-800'
  }[variant];

  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6'
  }[padding];

  return (
    <div
      className={`rounded-xl transition-all duration-200 ${variantStyles} ${paddingStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
