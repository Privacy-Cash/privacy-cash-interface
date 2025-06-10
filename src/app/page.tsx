'use client'
import WalletCard from "@/components/walletCard";
import { useEffect, useState } from "react";


export default function Home() {

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      flex: 1,
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
