import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'

import './globals.css'
import { CursorAutoHide } from '@/components/cursor-auto-hide'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

export const metadata: Metadata = {
  title: 'Universal Eye | Web Inspection System',
  description: 'AI-powered web inspection and defect detection system',
}

export const viewport: Viewport = {
  themeColor: '#0a0b14',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased overflow-hidden">
        <CursorAutoHide />
        {children}
      </body>
    </html>
  )
}
