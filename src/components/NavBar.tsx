"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const links = [
  { href: "/crm/dashboard", label: "Dashboard", short: "แดช" },
  { href: "/crm/top-customers", label: "Top 100", short: "Top" },
  { href: "/crm/deals", label: "ดีล", short: "ดีล" },
  { href: "/crm/customers", label: "ลูกค้า", short: "ลูกค้า" },
  { href: "/crm/documents", label: "เอกสาร", short: "เอกสาร" },
  { href: "/crm/products", label: "สินค้า", short: "สินค้า" },
  { href: "/crm/salespersons", label: "พนักงาน", short: "ทีม" },
]

export default function NavBar() {
  const pathname = usePathname()
  const activeLabel = links.find(({ href }) => href === "/crm/dashboard" ? pathname === href : pathname.startsWith(href))?.label ?? "CRM"

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
            {links.map(({ href, label }) => {
              const active = href === "/crm/dashboard"
                ? pathname === href
                : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "rounded-md bg-[var(--crm-brand-soft)] px-3 py-2 text-sm font-bold text-[var(--crm-brand-accent)]"
                      : "rounded-md px-3 py-2 text-sm font-medium text-[var(--crm-muted)] hover:bg-white hover:text-[var(--crm-brand)]"
                  }
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--crm-line)] bg-[rgb(248_251_255_/_96%)] px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_30px_rgb(29_78_216_/_10%)] backdrop-blur md:hidden">
        <div className="grid grid-cols-7 gap-1">
          {links.map(({ href, short }) => {
            const active = href === "/crm/dashboard"
              ? pathname === href
              : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-md bg-[var(--crm-brand-accent)] px-1.5 py-2 text-center text-[11px] font-bold text-white"
                    : "rounded-md px-1.5 py-2 text-center text-[11px] font-semibold text-[var(--crm-muted)]"
                }
              >
                {short}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
