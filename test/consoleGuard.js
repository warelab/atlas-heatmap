import { vi } from 'vitest'

// Fails a test that writes to console.error or console.warn, so React warnings (legacy lifecycles, defaultProps,
// keys, failed prop types, act(...)) break the suite instead of scrolling past. test/setup.js starts the guard
// before and stops it after every test; a test that expects console output calls allowConsole().

let allowed = false
let spies = []

export const allowConsole = () => {
  allowed = true
}

export const startConsoleGuard = () => {
  allowed = false
  spies = [`error`, `warn`].map(level => ({level, spy: vi.spyOn(console, level).mockImplementation(() => {})}))
}

const describeCall = (level, args) =>
  `console.${level}: ` + args.map(a => (a instanceof Error ? a.stack : typeof a === `string` ? a : String(a))).join(` `)

export const stopConsoleGuard = () => {
  const calls = spies.flatMap(({level, spy}) => spy.mock.calls.map(args => describeCall(level, args)))
  spies.forEach(({spy}) => spy.mockRestore())
  spies = []
  if (!allowed && calls.length > 0) {
    throw new Error(
      `Unexpected console output (call allowConsole() in tests that expect it):\n` + calls.join(`\n`).slice(0, 4000))
  }
}
