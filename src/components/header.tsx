'use client'
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useRef, useState } from "react";
import { toastSuccess } from "./toast";
import WalletConnectButton from "./walletConnectBtn";
import { solanaNetwork } from "./walletProvider";
import Dropdown from './ui/dropdown';
import { Icon } from "./ui/icons";


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

    const handleDisconnect = async () => {
        try {
            localStorage.removeItem('walletAdapter') // Remove persisted wallet name
            select(null) // Reset the selected wallet to force re-selection next time
            await disconnect()
        } catch (err) {
            console.error('Failed to disconnect wallet:', err)
        }
    }
    const handleCopyAddress = async () => {
        if (!publicKey) {
            return
        }
        try {
            await navigator.clipboard.writeText(publicKey.toString());
            toastSuccess('Copied', { duration: 1000 })
        } catch (err) {
            console.error('failed:', err);
        }
    };

    return <div className="navbar">
        <div>
            <img src="/logo.png" style={{ width: 35, height: 35 }} />
        </div>
        {publicKey ?

            <div className="top_right">

                <Dropdown trigger={<div className="user_panel_btn">
                    <img src="/solana_logo.png" style={{ width: 26, height: 26 }} />
                    <CopyableShortString str={publicKey.toString()} />
                    <Icon name="angleDown" />
                </div>}>
                    <div>
                        <button className="btn btn-plain btn-sm" onClick={handleCopyAddress}>
                            <Icon name='copy' />
                            <span>Copy Address</span></button>
                    </div>
                    <div>
                        <button className="btn btn-plain btn-sm" onClick={handleDisconnect}>
                            <Icon name="exit" /><span className="disconnect_btn">Disconnect</span></button>
                    </div>
                </Dropdown>

            </div>

            : <WalletConnectButton />}
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

    return (
        <span
            style={{
                display: 'inline-block',
                width: 'auto',
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