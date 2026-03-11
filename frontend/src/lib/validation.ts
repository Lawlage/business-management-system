export type ValidationRule<T> = {
  field: keyof T
  required?: boolean
  minLength?: number
  min?: number
  message: string
}

export type ValidationErrors<T> = Partial<Record<keyof T, string>>

export function validate<T extends Record<string, unknown>>(
  rules: ValidationRule<T>[],
  values: T,
): ValidationErrors<T> {
  const errors: ValidationErrors<T> = {}

  for (const rule of rules) {
    const value = values[rule.field]

    if (rule.required) {
      if (value === undefined || value === null || String(value).trim() === '') {
        errors[rule.field] = rule.message
        continue
      }
    }

    if (rule.minLength !== undefined && typeof value === 'string') {
      if (value.trim().length < rule.minLength) {
        errors[rule.field] = rule.message
        continue
      }
    }

    if (rule.min !== undefined && typeof value === 'number') {
      if (value < rule.min) {
        errors[rule.field] = rule.message
        continue
      }
    }
  }

  return errors
}

export function hasErrors<T>(errors: ValidationErrors<T>): boolean {
  return Object.keys(errors).length > 0
}
