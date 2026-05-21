"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const links = [
  { href: "/crm/dashboard", label: "Dashboard" },
  { href: "/crm/customers", label: "ลูกค้า" },
  { href: "/crm/documents", label: "เอกสาร" },
  { href: "/crm/products", label: "สินค้า" },
  { href: "/crm/salespersons", label: "พนักงาน" },
]

export default function NavBar() {
  const pathname = usePathname()
  return (
    <nav className="border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-gray-800">CRM</span>
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
                  ? "text-sm font-semibold text-blue-600"
                  : "text-sm text-gray-600 hover:text-blue-600"
              }
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
