import type { Metadata } from 'next'
import './globals.css'
import { AppLayout } from '@/components/layout/AppLayout'

export const metadata: Metadata = {
  title: 'noado | 임대 관리 자동화',
  description: '소규모 임대 사업자를 위한 올인원 임대 관리 솔루션',
  icons: { icon: '/images/noado_dark_icon_1772569526686.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AppLayout>
          {children}
        </AppLayout>
      </body>
    </html>
  )
}
