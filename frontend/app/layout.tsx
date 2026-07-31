import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConfigProvider, App as AntApp } from "antd";
import { AuthProvider } from "@/lib/auth/auth-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Delfos - Oracle para Bancos de Dados Heterogêneos",
  description: "Sistema de autenticação e interface principal do Delfos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConfigProvider
          theme={{
            token: {
              colorBgBase: '#ffffff',
              colorText: '#000000',
            },
          }}
        >
          <AntApp>
            <AuthProvider>
              {children}
            </AuthProvider>
          </AntApp>
        </ConfigProvider>
      </body>
    </html>
  );
}
