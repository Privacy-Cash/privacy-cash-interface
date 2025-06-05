'use client'
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useRef, useState } from "react";
import { toastSuccess } from "./toast";
import WalletConnectButton from "./walletConnectBtn";
import { solanaNetwork } from "./walletProvider";


export default function Header() {
    const {
        wallets,
        wallet,
        publicKey,
        select,
        connect,
        disconnect,
        connected,
        connecting
    } = useWallet()
    return <div className="navbar">
        {publicKey ?
            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <div style={{ width: 10, height: 10, backgroundColor: '#05f535', borderRadius: 10 }}></div>
                <div>Solana</div>
                <div>({solanaNetwork})</div>
                <CopyableShortString str={publicKey.toString()} />
            </div> : <></>}
        <WalletConnectButton showDisconnect={true} />
    </div>
}

function CopyableShortString({ str }: { str: string }) {
    const shortStr = str.length > 6 ? `${str.slice(0, 3)}...${str.slice(-3)}` : str;
    const spanRef = useRef(null);
    const [width, setWidth] = useState(null);

    useEffect(() => {
        if (spanRef.current) {
            // @ts-ignore
            setWidth(spanRef.current.offsetWidth);
        }
    }, [shortStr]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(str);
            toastSuccess('Copied', { duration: 1000 })
        } catch (err) {
            console.error('failed:', err);
        }
    };

    return (
        <span
            onClick={handleCopy}
            style={{
                display: 'inline-block',
                width: width ? `${width}px` : 'auto',
                cursor: 'pointer',
                userSelect: 'none',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                position: 'relative',
                paddingLeft: 5
            }}
        >
            <span ref={spanRef}>
                {shortStr}
            </span>
        </span>
    );
}