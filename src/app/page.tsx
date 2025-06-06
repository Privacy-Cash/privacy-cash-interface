'use client'
import Image from "next/image";
import styles from "./page.module.css";
import WalletCard from "@/components/walletCard";
import { localstorageKey } from "@/utils/getMyUtxos";
import { useWallet } from "@solana/wallet-adapter-react";

export default function Home() {
  const {
    publicKey,
  } = useWallet()
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      flex: 1,
    }}>
      <WalletCard />

      <button onClick={() => {
        if (publicKey) {
          localStorage.setItem('fetchUtxoOffset' + localstorageKey(publicKey), '0')
          localStorage.setItem('encryptedOutputs' + localstorageKey(publicKey), '')
        }
      }}>
        reset offset index
      </button>
    </div>
  );
}
