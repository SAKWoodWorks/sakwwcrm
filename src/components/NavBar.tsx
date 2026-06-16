"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Link, usePathname } from "@/i18n/navigation"
import { ChevronDownIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

type NavLink = {
  href: string
  labelKey: string
  shortKey: string
}

type NavGroup = {
  labelKey: string
  shortKey: string
  links: NavLink[]
}

const primaryLinks: NavLink[] = [
  { href: "/crm/dashboard", labelKey: "dashboard", shortKey: "dashboardShort" },
  { href: "/crm/customers", labelKey: "customers", shortKey: "customersShort" },
  { href: "/crm/deals", labelKey: "deals", shortKey: "dealsShort" },
  { href: "/crm/follow-up", labelKey: "followUp", shortKey: "followUpShort" },
  { href: "/crm/documents", labelKey: "documents", shortKey: "documentsShort" },
]

const navGroups: NavGroup[] = [
  {
    labelKey: "reports",
    shortKey: "reportsShort",
    links: [
      { href: "/crm/top-customers", labelKey: "topCustomers", shortKey: "topCustomersShort" },
      { href: "/crm/monthly-sales", labelKey: "monthlySales", shortKey: "monthlySalesShort" },
    ],
  },
  {
    labelKey: "data",
    shortKey: "dataShort",
    links: [
      { href: "/crm/products", labelKey: "products", shortKey: "productsShort" },
      { href: "/crm/salespersons", labelKey: "salespersons", shortKey: "salespersonsShort" },
    ],
  },
  {
    labelKey: "tools",
    shortKey: "toolsShort",
    links: [
      { href: "/crm/import", labelKey: "import", shortKey: "importShort" },
      { href: "/crm/delivery-cost", labelKey: "delivery", shortKey: "deliveryShort" },
    ],
  },
]

const links = [...primaryLinks, ...navGroups.flatMap((group) => group.links)]
const mobileLinks = primaryLinks.slice(0, 4)
const mobileMoreLinks = [...primaryLinks.slice(4), ...navGroups.flatMap((group) => group.links)]
const locales = ["th", "en", "ru"] as const

export default function NavBar() {
  const t = useTranslations("Nav")
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const localeHref = query ? `${pathname}?${query}` : pathname
  const activeLink = links.find(({ href }) => href === "/crm/dashboard" ? pathname === href : pathname.startsWith(href))
  const activeLabel = activeLink ? t(activeLink.labelKey) : "CRM"

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-[var(--crm-line)] bg-[rgb(248_251_255_/_92%)] px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1440px] items-center gap-5">
          <Link href="/crm/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--crm-brand)] text-sm font-black tracking-wide text-white">
              SW
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[var(--crm-ink)]">SAK CRM</span>
              <span className="block truncate text-xs text-[var(--crm-muted)] md:hidden">{activeLabel}</span>
            </span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {primaryLinks.map((link) => (
              <NavLinkItem key={link.href} link={link} pathname={pathname} />
            ))}
            {navGroups.map((group) => (
              <NavDropdown key={group.labelKey} group={group} pathname={pathname} />
            ))}
          </div>
          <div className="ml-auto hidden items-center gap-1 rounded-md border border-[var(--crm-line)] bg-white p-1 text-xs font-bold md:flex" aria-label={t("language")}>
            {locales.map((item) => (
              <Link
                key={item}
                href={localeHref}
                locale={item}
                aria-current={locale === item ? "page" : undefined}
                className={
                  locale === item
                    ? "rounded bg-[var(--crm-brand)] px-2 py-1 text-white"
                    : "rounded px-2 py-1 text-[var(--crm-muted)] hover:bg-gray-50 hover:text-[var(--crm-brand)]"
                }
              >
                {item.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--crm-line)] bg-[rgb(248_251_255_/_96%)] px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_30px_rgb(29_78_216_/_10%)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileLinks.map((link) => (
            <MobileNavLink key={link.href} link={link} pathname={pathname} />
          ))}
          <MobileMoreMenu links={mobileMoreLinks} pathname={pathname} />
        </div>
      </nav>
    </>
  )
}

function NavLinkItem({ link, pathname }: { link: NavLink; pathname: string }) {
  const t = useTranslations("Nav")
  const active = isActivePath(pathname, link.href)

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-md bg-[var(--crm-brand-soft)] px-3 py-2 text-sm font-bold text-[var(--crm-brand-accent)]"
          : "rounded-md px-3 py-2 text-sm font-medium text-[var(--crm-muted)] hover:bg-white hover:text-[var(--crm-brand)]"
      }
    >
      {t(link.labelKey)}
    </Link>
  )
}

function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const t = useTranslations("Nav")
  const active = group.links.some((link) => isActivePath(pathname, link.href))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          active
            ? "inline-flex items-center gap-1 rounded-md bg-[var(--crm-brand-soft)] px-3 py-2 text-sm font-bold text-[var(--crm-brand-accent)] outline-none"
            : "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-[var(--crm-muted)] outline-none hover:bg-white hover:text-[var(--crm-brand)]"
        }
      >
        {t(group.labelKey)}
        <ChevronDownIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 border border-[var(--crm-line)] bg-white">
        {group.links.map((link) => (
          <DropdownMenuItem key={link.href} asChild className="px-3 py-2">
            <Link
              href={link.href}
              aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
              className="w-full text-[var(--crm-ink)]"
            >
              {t(link.labelKey)}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MobileNavLink({ link, pathname }: { link: NavLink; pathname: string }) {
  const t = useTranslations("Nav")
  const active = isActivePath(pathname, link.href)

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-md bg-[var(--crm-brand-accent)] px-1.5 py-2 text-center text-[11px] font-bold text-white"
          : "rounded-md px-1.5 py-2 text-center text-[11px] font-semibold text-[var(--crm-muted)]"
      }
    >
      {t(link.shortKey)}
    </Link>
  )
}

function MobileMoreMenu({ links, pathname }: { links: NavLink[]; pathname: string }) {
  const t = useTranslations("Nav")
  const active = links.some((link) => isActivePath(pathname, link.href))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          active
            ? "rounded-md bg-[var(--crm-brand-accent)] px-1.5 py-2 text-center text-[11px] font-bold text-white outline-none"
            : "rounded-md px-1.5 py-2 text-center text-[11px] font-semibold text-[var(--crm-muted)] outline-none"
        }
      >
        {t("moreShort")}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="mb-2 w-56 border border-[var(--crm-line)] bg-white">
        {links.map((link) => (
          <DropdownMenuItem key={link.href} asChild className="px-3 py-2">
            <Link
              href={link.href}
              aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
              className="w-full text-[var(--crm-ink)]"
            >
              {t(link.labelKey)}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function isActivePath(pathname: string, href: string) {
  return href === "/crm/dashboard" ? pathname === href : pathname.startsWith(href)
}
