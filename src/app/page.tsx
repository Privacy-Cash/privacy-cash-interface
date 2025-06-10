'use client'
import WalletCard from "@/components/walletCard";
import { useEffect, useState } from "react";

export default function Home() {
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setOpacity(1);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      flex: 1,
      opacity: opacity,
      transition: 'opacity 0.3s ease-in-out'
    }}>
      <WalletCard />

      {/* <button onClick={() => {
        if (publicKey) {
          localStorage.setItem('fetchUtxoOffset' + localstorageKey(publicKey), '0')
          localStorage.setItem('encryptedOutputs' + localstorageKey(publicKey), '')
        }
      }}>
        reset offset index
      </button> */}
    </div>
  );
}
