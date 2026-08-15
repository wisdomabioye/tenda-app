/** Form-level (not field-level) error line, one look everywhere. */
export function FormError({ message }: { message: string | null }) {
  if (message === null) return null
  return <p className="text-sm text-feedback-danger-text">{message}</p>
}
