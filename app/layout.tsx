import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'PhotoHUB - удобная пакетная обработка фотографий для вашей организации',
  description: 'Система генерации профессиональных портретов для медучреждений',
  icons: { icon: '/favicon.png' },
}

export const viewport: Viewport = {
  themeColor: '#1a2540',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
