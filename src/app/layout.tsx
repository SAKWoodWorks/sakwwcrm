import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import NavBar from "@/components/NavBar"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CRM",
  description: "Sales CRM",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={geist.className}>
        <NavBar />
        <main className="crm-main">{children}</main>
      </body>
    </html>
  )
}
