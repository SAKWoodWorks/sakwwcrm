import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { cookies } from "next/headers"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CRM",
  description: "Sales CRM",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "th"

  return (
    <html lang={locale}>
      <body className={geist.className}>
        {children}
      </body>
    </html>
  )
}
