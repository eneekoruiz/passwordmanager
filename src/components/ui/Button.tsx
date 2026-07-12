import React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {

    const baseStyles = "inline-flex items-center justify-center rounded-2xl font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:pointer-events-none"

    const variants = {
      primary: "bg-accent hover:bg-accent-strong text-white shadow-premium",
      secondary: "bg-surface-elevated hover:bg-surface-hover text-text-primary border border-border-subtle",
      danger: "bg-danger hover:bg-red-700 text-white shadow-premium",
      ghost: "hover:bg-surface-hover text-text-secondary hover:text-text-primary",
      glass: "bg-white/20 dark:bg-black/20 backdrop-blur-md border border-white/30 dark:border-white/10 text-text-primary hover:bg-white/30 shadow-glass"
    }

    const sizes = {
      sm: "h-9 px-4 text-xs",
      md: "h-11 px-6 text-sm",
      lg: "h-14 px-8 text-base",
      icon: "h-11 w-11"
    }

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.96 }}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
