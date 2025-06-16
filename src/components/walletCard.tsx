'use client'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { hasherAtom, isDepositingAtom, isWithdrawingAtom, statusAtom, updatingUtxoAtom, userUtxoAmount } from '../utils/atoms'
import { getAccountSign } from '../utils/getAccountSign'
import { getBalanceFromUtxos, getMyUtxos } from '../utils/getMyUtxos'
import WalletConnectButton from './walletConnectBtn'
import { Withdraw } from './withdraw'
import dynamic from 'next/dynamic';


export default function WalletCard() {

    const {
        publicKey,
    } = useWallet()
    const [hasher, setHasher] = useAtom(hasherAtom)
    const { connection } = useConnection()
    const [isUpdatingUtxo, setIsUpdatingUtxo] = useAtom(updatingUtxoAtom)
    const [userUtxo, setUserUtxo] = useAtom(userUtxoAmount)
    const [status, setStatus] = useAtom(statusAtom)
    const [isDepositing] = useAtom(isDepositingAtom)

    // load hasher from web browser
    useEffect(() => {
        if (typeof window === 'undefined') return; // return if not in web browser

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
        console.log('updateUtxo is called')
        if (!isUpdatingUtxo) {
            console.log('start updating utxo')
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
                    try {
                        console.log('checking user sign')
                        let myValidUtxos = await getMyUtxos(signed, connection, setStatus, hasher)
                        if (myValidUtxos.length === 0) {
                            console.log('No UTXOs found for this keypair.');
                            setUserUtxo(0)
                        } else {
                            newUtxo = getBalanceFromUtxos(myValidUtxos)
                        }
                        setUserUtxo(newUtxo)
                    } catch (e) {
                        console.log('problem occurred on getting utxo')
                        setUserUtxo(0)
                    }
                } else {
                    // user is not signed, display "0 SOL"
                    console.log('user is not signed')
                    setUserUtxo(0)
                }
            } catch (e) {
                console.log('problem occurred on signing')
                // user not signed
                setUserUtxo(0)
            }

            setIsUpdatingUtxo(false)
            if (newUtxo != orgUtxo) {
                return true
            }
        }
        return false
    }

    // after user connected wallet, update Utxo
    useEffect(() => {
        console.log('user wallet switched')
        if (!publicKey) {
            console.log('publicKey is not ready')
            return
        }
        if (!hasher) {
            console.log('hasher is not ready')
            return
        }
        updateUtxo()
    }, [publicKey, hasher])


    return (
        <div className='card'>
            <div style={{ display: "flex", flexDirection: 'column', gap: 20 }}>
                <div>
                    <Withdraw updateUtxo={updateUtxo} />
                    <div style={{ fontSize: '0.8em', textAlign: 'center', height: 17, padding: '7px 0', display: publicKey ? 'block' : 'none' }}>
                        <center>{status}</center>
                    </div>
                </div>
            </div>
        </div>
    )
}
