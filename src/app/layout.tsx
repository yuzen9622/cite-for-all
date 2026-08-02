import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Cite for All｜文獻引用格式轉換",
    template: "%s｜Cite for All",
  },
  description:
    "用 DOI 或論文標題，將單筆或多筆文獻轉換為 APA 7th、MLA 9、Chicago、Harvard、IEEE、Vancouver 或 BibTeX。",
  openGraph: {
    title: "Cite for All｜文獻引用格式轉換",
    description: "貼上 DOI 或論文標題，一次完成七種引用格式。",
    type: "website",
    locale: "zh_TW",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "Cite for All — 文獻格式，一次轉對。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cite for All",
    description: "單筆、批次，七種引用格式一次完成。",
    images: ["/og.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-svh antialiased">
        <SessionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
