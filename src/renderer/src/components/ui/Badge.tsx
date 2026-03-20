interface BadgeProps {
  label: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'category'
}

const styles = {
  default: 'bg-gray-100/80 text-gray-500',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-500',
  category: 'bg-blush-50 text-blush-600'
}

export default function Badge({ label, variant = 'default' }: BadgeProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide ${styles[variant]}`}
    >
      {label}
    </span>
  )
}
