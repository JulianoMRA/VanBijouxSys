interface BadgeProps {
  label: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'category'
}

const variantClass: Record<string, string> = {
  default:  '',
  success:  'good',
  warning:  'warn',
  danger:   'bad',
  category: 'accent'
}

export default function Badge({ label, variant = 'default' }: BadgeProps): JSX.Element {
  return (
    <span className={`badge ${variantClass[variant]}`}>
      {label}
    </span>
  )
}
