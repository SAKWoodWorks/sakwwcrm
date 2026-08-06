export type NavLink = {
  href: string
  labelKey: string
  shortKey: string
}

export type NavGroup = {
  labelKey: string
  shortKey: string
  links: NavLink[]
}

export const primaryLinks: NavLink[] = [
  { href: "/crm/dashboard", labelKey: "dashboard", shortKey: "dashboardShort" },
  { href: "/crm/customers", labelKey: "customers", shortKey: "customersShort" },
  { href: "/crm/deals", labelKey: "deals", shortKey: "dealsShort" },
  { href: "/crm/follow-up", labelKey: "followUp", shortKey: "followUpShort" },
  { href: "/crm/documents", labelKey: "documents", shortKey: "documentsShort" },
]

export const navGroups: NavGroup[] = [
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

export const allLinks = [...primaryLinks, ...navGroups.flatMap((g) => g.links)]
export const mobileLinks = primaryLinks.slice(0, 4)
export const mobileMoreLinks = [
  ...primaryLinks.slice(4),
  ...navGroups.flatMap((g) => g.links),
]
export const locales = ["th", "en", "ru"] as const
