import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CRM",
  description: "Sales CRM",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)NEXT_LOCALE=([^;]+)/);if(m)document.documentElement.lang=decodeURIComponent(m[1]);}catch(e){}})()`
          }}
        />
      </head>
      <body className={geist.className}>
        {children}
      </body>
    </html>
  )
}
