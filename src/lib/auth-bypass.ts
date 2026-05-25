export function isAuthBypassed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DISABLE_AUTH === "true"
}
