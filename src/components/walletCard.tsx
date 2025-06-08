'use client'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { hasherAtom, isDepositingAtom, isWithdrawingAtom, statusAtom, updatingUtxoAtom, userUtxoAmount } from '../utils/atoms'
import { getAccountSign } from '../utils/getAccountSign'
import { getBalanceFromUtxos, getMyUtxos } from '../utils/getMyUtxos'
import { Deposit } from './deposit'
import WalletConnectButton from './walletConnectBtn'
import { Withdraw } from './withdraw'
import dynamic from 'next/dynamic';


export default function WalletCard() {

    const {
        publicKey,
    } = useWallet()
    const [hasher, setHasher] = useAtom(hasherAtom)
    const { connection } = useConnection()
    const [liveTab, setLiveTab] = useState<"deposit" | "withdraw">("deposit")
    const [isUpdatingUtxo, setIsUpdatingUtxo] = useAtom(updatingUtxoAtom)
    const [userUtxo, setUserUtxo] = useAtom(userUtxoAmount)
    const [status, setStatus] = useAtom(statusAtom)
    const [isDepositing] = useAtom(isDepositingAtom)

    useEffect(() => {
        if (typeof window === 'undefined') return; // 确保仅客户端执行

        (async () => {
            console.log('loading hashser')
            try {
                const { WasmFactory } = await import('@lightprotocol/hasher.rs');
                // const lightWasm = await WasmFactory.loadHasher({ wasm: 'light_wasm_hasher_bg.wasm' });
                const lightWasm = await WasmFactory.getInstance()
                setHasher(lightWasm);
                console.log('WASM Loaded:', lightWasm);
            } catch (err) {
                console.error('Failed to load wasm hasher:', err);
            }
        })();
    }, [])
    // ask for signing and update user Utxo balance
    const updateUtxo = async () => {
        if (!isUpdatingUtxo) {
            setIsUpdatingUtxo(true)
            let orgUtxo = userUtxo
            let newUtxo = 0
            try {
                let signed = await getAccountSign()
                if (signed) {
                    console.log('Got sign. Fetching txos')
                    if (!hasher) {
                        console.log('updateUtxo: hasher not ready')
                    }
                    let myValidUtxos = await getMyUtxos(signed, connection, setStatus, hasher)
                    if (myValidUtxos.length === 0) {
                        console.log('No UTXOs found for this keypair.');
                    } else {
                        newUtxo = getBalanceFromUtxos(myValidUtxos)
                    }
                    setUserUtxo(newUtxo)
                }
            } catch (e) {
                console.error(e)
            }
            setIsUpdatingUtxo(false)
            if (newUtxo != orgUtxo) {
                return true
            }
        }
        return false
    }

    const handleWithdrawTabClick = async () => {
        setLiveTab('withdraw')
    }

    // after user connected wallet, update Utxo
    useEffect(() => {
        if (publicKey && hasher) {
            updateUtxo()
        }
    }, [publicKey, hasher])


    return (
        <div className='card'>
            <div style={{ display: "flex", flexDirection: 'column', gap: 20 }}>
                <div>
                    <div className='tabs'>
                        <div className='tab' onClick={() => setLiveTab('deposit')} style={liveTab == 'deposit' ? { backgroundColor: '#16a34a', color: 'white' } : {}}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="btn-svg"><path d="M17 7 7 17"></path><path d="M17 17H7V7"></path></svg>
                            Deposit</div>
                        <div className='tab' onClick={handleWithdrawTabClick} style={liveTab == 'withdraw' ? { backgroundColor: '#dc2626', color: 'white' } : {}}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="btn-svg"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>
                            Private Withdraw</div>
                    </div>
                </div>
                <div>
                    <div style={{ display: liveTab == "deposit" ? 'block' : 'none' }}>
                        <Deposit updateUtxo={updateUtxo} />
                    </div>
                    <div style={{ display: liveTab == "withdraw" ? 'block' : 'none' }}>
                        <Withdraw updateUtxo={updateUtxo} />
                    </div>
                    <div style={{ fontSize: '0.8em', textAlign: 'center', height: 17, padding: '7px 0', display: publicKey ? 'block' : 'none' }}>
                        <center style={{ display: (isDepositing || liveTab == "withdraw") ? 'block' : 'none' }}>{status}</center>
                    </div>
                </div>

                {!publicKey && <>
                    <center style={{ color: "var(--color-fg2)" }}>Connect your wallet to deposit SOL</center>
                    <WalletConnectButton size='lg' />
                    <div style={{ height: 10 }}></div>
                </>
                }
            </div>
        </div>
    )
}
