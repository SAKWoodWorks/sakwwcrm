import NavBar from "@/components/NavBar"
import { Toaster } from "@/components/ui/sonner"
import { routing } from "@/i18n/routing"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { notFound } from "next/navigation"
import ChatBubble from "./crm/ChatBubble"

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  return (
    <NextIntlClientProvider>
      <NavBar />
      <main className="crm-main">{children}</main>
      <Toaster richColors position="top-right" />
      <ChatBubble />
    </NextIntlClientProvider>
  )
}
