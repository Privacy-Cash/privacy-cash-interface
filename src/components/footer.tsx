'use client'
import { useWallet } from "@solana/wallet-adapter-react";

export default function Footer() {
    const { publicKey } = useWallet()
    return <div className="footer">

    </div>
}