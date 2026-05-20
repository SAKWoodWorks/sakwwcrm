import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import Link from "next/link"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CRM",
  description: "Sales CRM",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={geist.className}>
        <nav className="border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-gray-800">CRM</span>
            <Link
              href="/crm/customers"
              className="text-sm text-gray-600 hover:text-blue-600"
            >
              ลูกค้า
            </Link>
            <Link
              href="/crm/documents"
              className="text-sm text-gray-600 hover:text-blue-600"
            >
              เอกสาร
            </Link>
            <Link
              href="/crm/products"
              className="text-sm text-gray-600 hover:text-blue-600"
            >
              สินค้า
            </Link>
            <Link
              href="/crm/salespersons"
              className="text-sm text-gray-600 hover:text-blue-600"
            >
              พนักงาน
            </Link>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  )
}
