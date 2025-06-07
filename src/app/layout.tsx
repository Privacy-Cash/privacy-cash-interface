import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/global.css";
import { Toaster } from "react-hot-toast";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { WalletContextProvider } from "@/components/walletProvider";
import '@solana/wallet-adapter-react-ui/styles.css';
import { BufferProvider } from '../components/bufferProvider';

export const metadata: Metadata = {
  title: "Privacy Cash",
  description: "Send SOL privately",
  icons: {
    icon: '/logo.png',
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body >
        <BufferProvider>
          <Toaster containerStyle={{
            top: '90px'
          }} />
          <WalletContextProvider>
            <div className="outer_div">
              <Header />
              {children}
            </div>
          </WalletContextProvider>
        </BufferProvider>
      </body>
    </html>
  );
}
