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
import { allLinks, locales, type NavGroup, type NavLink } from "./navConfig"

function isActivePath(pathname: string, href: string) {
  return href === "/crm/dashboard" ? pathname === href : pathname.startsWith(href)
}

export function NavActiveLabel() {
  const t = useTranslations("Nav")
  const pathname = usePathname()
  const activeLink = allLinks.find(({ href }) => isActivePath(pathname, href))
  const label = activeLink ? t(activeLink.labelKey) : "CRM"
  return <span className="block truncate text-xs text-[var(--crm-muted)] md:hidden">{label}</span>
}

export function NavLocaleSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const localeHref = query ? `${pathname}?${query}` : pathname

  return (
    <>
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
    </>
  )
}

export function NavLinkItem({ link }: { link: NavLink }) {
  const t = useTranslations("Nav")
  const pathname = usePathname()
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

export function NavDropdown({ group }: { group: NavGroup }) {
  const t = useTranslations("Nav")
  const pathname = usePathname()
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

export function NavMobileLink({ link }: { link: NavLink }) {
  const t = useTranslations("Nav")
  const pathname = usePathname()
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

export function NavMobileMore({ links }: { links: NavLink[] }) {
  const t = useTranslations("Nav")
  const pathname = usePathname()
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
