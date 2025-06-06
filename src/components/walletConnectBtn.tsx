'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useEffect, useMemo, useState } from 'react'
import { getAccountSign } from '../utils/getAccountSign'


export default function WalletConnectButton({ size = 'nm' }: { showDisconnect?: boolean, size?: 'nm' | 'lg' }) {
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

    const [requested, setRequested] = useState(false)

    const installedWallets = useMemo(
        () => wallets.filter(w => w.readyState === 'Installed'),
        [wallets]
    )
    const { setVisible } = useWalletModal();

    // Triggered when the user clicks the connect button
    const handleConnect = async () => {
        if (connected || connecting) return
        if (wallet) {
            // wallet was selected
            try {
                await connect();
                await getAccountSign()
            } catch (error) {
                console.error('failed to connect wallet:', error);
                // try select wallet again
                select(null); // clear selected wallet
            }
        } else {
            // provide a wallet selector
            setVisible(true);
        }
    }

    // After selecting a wallet, wait until the wallet is set and then connect
    useEffect(() => {
        const tryConnect = async () => {
            if (requested && wallet) {
                try {
                    await connect()
                } catch (err) {
                    console.error('Failed to connect after wallet selection:', err)
                } finally {
                    setRequested(false)
                }
            }
        }

        tryConnect()
    }, [wallet, requested])

    // If connected, show disconnect button
    if (connected && publicKey) {
        return null
    }

    // If not connected, show connect button
    return (
        <button onClick={handleConnect} className={"btn btn-linear" + (size == 'lg' ? ' btn-lg' : '')}>
            <WalletIcon />
            <span>Connect Wallet</span>
        </button>
    )
}


export function WalletIcon() {
    return <svg className="btn-svg" fill="currentColor" viewBox="0 0 36 36" version="1.1"  >
        <title>wallet-line</title>
        <path d="M32,15H31V9a1,1,0,0,0-1-1H6a1,1,0,0,1-1-.82V6.82A1,1,0,0,1,6,6H29.58a1,1,0,0,0,0-2H6A3,3,0,0,0,3,7a3.08,3.08,0,0,0,0,.36V27.93A4.1,4.1,0,0,0,7.13,32H30a1,1,0,0,0,1-1V25h1a1,1,0,0,0,1-1V16A1,1,0,0,0,32,15ZM29,30H7.13A2.11,2.11,0,0,1,5,27.93V9.88A3.11,3.11,0,0,0,6,10H29v5H22a5,5,0,0,0,0,10h7Zm2-7H22a3,3,0,0,1,0-6H31Z"></path>
    </svg>
}

