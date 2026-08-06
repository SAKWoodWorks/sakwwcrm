import { ChevronDownIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import NextLink from "next/link"
import { Suspense } from "react"
import {
  NavActiveLabel,
  NavDropdown,
  NavLinkItem,
  NavLocaleSwitcher,
  NavMobileLink,
  NavMobileMore,
} from "./NavBarClient"
import {
  locales,
  mobileLinks,
  mobileMoreLinks,
  navGroups,
  primaryLinks,
} from "./navConfig"

export default async function NavBar() {
  const [t, locale] = await Promise.all([getTranslations("Nav"), getLocale()])
  const lp = (href: string) => `/${locale}${href}`

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-[var(--crm-line)] bg-[rgb(248_251_255_/_92%)] px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1440px] items-center gap-5">
          <NextLink href={lp("/crm/dashboard")} className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--crm-brand)] text-sm font-black tracking-wide text-white">
              SW
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[var(--crm-ink)]">SAK CRM</span>
              <Suspense fallback={<span className="block truncate text-xs text-[var(--crm-muted)] md:hidden">CRM</span>}>
                <NavActiveLabel />
              </Suspense>
            </span>
          </NextLink>

          <div className="hidden items-center gap-1 md:flex">
            {primaryLinks.map((link) => (
              <Suspense
                key={link.href}
                fallback={
                  <NextLink
                    href={lp(link.href)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-[var(--crm-muted)] hover:bg-white hover:text-[var(--crm-brand)]"
                  >
                    {t(link.labelKey)}
                  </NextLink>
                }
              >
                <NavLinkItem link={link} />
              </Suspense>
            ))}
            {navGroups.map((group) => (
              <Suspense
                key={group.labelKey}
                fallback={
                  <span className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-[var(--crm-muted)]">
                    {t(group.labelKey)}
                    <ChevronDownIcon className="size-4" aria-hidden="true" />
                  </span>
                }
              >
                <NavDropdown group={group} />
              </Suspense>
            ))}
          </div>

          <div
            className="ml-auto hidden items-center gap-1 rounded-md border border-[var(--crm-line)] bg-white p-1 text-xs font-bold md:flex"
            aria-label={t("language")}
          >
            <Suspense
              fallback={
                <>
                  {locales.map((item) => (
                    <span key={item} className="rounded px-2 py-1 text-[var(--crm-muted)]">
                      {item.toUpperCase()}
                    </span>
                  ))}
                </>
              }
            >
              <NavLocaleSwitcher />
            </Suspense>
          </div>
        </div>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--crm-line)] bg-[rgb(248_251_255_/_96%)] px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_30px_rgb(29_78_216_/_10%)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileLinks.map((link) => (
            <Suspense
              key={link.href}
              fallback={
                <NextLink
                  href={lp(link.href)}
                  className="rounded-md px-1.5 py-2 text-center text-[11px] font-semibold text-[var(--crm-muted)]"
                >
                  {t(link.shortKey)}
                </NextLink>
              }
            >
              <NavMobileLink link={link} />
            </Suspense>
          ))}
          <Suspense
            fallback={
              <span className="rounded-md px-1.5 py-2 text-center text-[11px] font-semibold text-[var(--crm-muted)]">
                {t("moreShort")}
              </span>
            }
          >
            <NavMobileMore links={mobileMoreLinks} />
          </Suspense>
        </div>
      </nav>
    </>
  )
}
