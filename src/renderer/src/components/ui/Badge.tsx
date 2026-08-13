interface BadgeProps {
  label: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'category'
}

const styles = {
  default: 'bg-bone-300 text-ink-500',
  success: 'bg-sage-100 text-sage-500',
  warning: 'bg-honey-100 text-honey-500',
  danger: 'bg-clay-100 text-clay-500',
  category: 'bg-wine-50 text-wine-500'
}

export default function Badge({ label, variant = 'default' }: BadgeProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-meta font-semibold tracking-wide ${styles[variant]}`}
    >
      {label}
    </span>
  )
}
