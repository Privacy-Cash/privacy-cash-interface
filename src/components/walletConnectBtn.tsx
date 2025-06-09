'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useEffect, useMemo, useState } from 'react'
import { getAccountSign } from '../utils/getAccountSign'
import { Icon } from './ui/icons'


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
            <Icon name='wallet' />
            <span>Connect Wallet</span>
        </button>
    )
}
