let counter = 0

// Short, locally-unique ids. These are never serialized into the URL
// (items are referenced by index there), so they only need to be unique
// within the current session.
export function makeId(prefix = 'x'): string {
  counter += 1
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`
}
