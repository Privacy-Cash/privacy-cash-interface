'use client'
import {
    ConnectionProvider,
    WalletProvider
} from '@solana/wallet-adapter-react';
import {
    WalletModalProvider
} from '@solana/wallet-adapter-react-ui';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { type Cluster, clusterApiUrl } from '@solana/web3.js';
import { type FC, useMemo } from 'react';
export let currentNetwork: Cluster = 'devnet'
if (typeof process != 'undefined') {
    const networkEnv = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    if (['devnet', 'testnet', 'mainnet-beta'].includes(networkEnv as Cluster)) {
        currentNetwork = networkEnv as Cluster
    }
}
export const WalletContextProvider: FC<{ children: React.ReactNode }> = ({ children }) => {

    const endpoint = useMemo(() => clusterApiUrl(currentNetwork), [currentNetwork]);

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
