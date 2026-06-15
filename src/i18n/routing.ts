import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["th", "en", "ru"],
  defaultLocale: "th",
  localePrefix: "always",
})

export type Locale = (typeof routing.locales)[number]
