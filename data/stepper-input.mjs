export function stepperInput(value) {
 const raw = String(value ?? '')
 const valid = /^[1-9]\d{0,8}$/.test(raw)
 return {valid, value: valid ? Number(raw) : raw}
}

export function shiftStepper(value, delta, max = 999999999) {
 const input = stepperInput(value)
 const base = input.valid ? input.value : 0
 const limit = Number.isSafeInteger(max) ? Math.max(0, Math.min(999999999, max)) : 999999999
 if (limit === 0) return 0
 return Math.max(1, Math.min(limit, base + delta))
}
