'use client'
import { useWallet } from "@solana/wallet-adapter-react";
import { IconBtn } from "./ui/icons";

export default function Footer() {
    const { publicKey } = useWallet()
    return <div className="footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <a href="https://x.com/theprivacycash" target="_blank"><IconBtn name="x" /></a>
            <a href="https://github.com/Privacy-Cash/privacy-cash" target="_blank"><IconBtn name="github" /></a>
        </div>
    </div>
}