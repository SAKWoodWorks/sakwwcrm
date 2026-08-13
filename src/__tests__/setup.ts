import "@testing-library/jest-dom"
import { vi } from "vitest"

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()

  return {
    ...actual,
    connection: vi.fn(async () => undefined),
  }
})

vi.mock("next/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/cache")>()

  return {
    ...actual,
    unstable_cache: <Args extends unknown[], Result>(
      fn: (...args: Args) => Promise<Result>,
    ) => fn,
  }
})
