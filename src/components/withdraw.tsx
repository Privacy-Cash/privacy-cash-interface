'use client'
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"
import { useAtom } from "jotai"
import { useState } from "react"
import { hasherAtom, isDepositingAtom, isWithdrawingAtom, statusAtom, updatingUtxoAtom, userSOLAmount, userUtxoAmount } from "../utils/atoms"
import { getAccountSign } from "../utils/getAccountSign"
import { withdraw } from "../utils/withdraw"
import Spinner from "./spinner"
import { toastError, toastSuccess } from "./toast"

export function Withdraw({ updateUtxo }: { updateUtxo: Function }) {
    const [isUpdatingUtxo] = useAtom(updatingUtxoAtom)
    const [userUtxo, setUserUtxo] = useAtom(userUtxoAmount)
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [receptAddress, setReceptAddress] = useState('')
    const [isDepositing, setIsDepositing] = useAtom(isDepositingAtom)
    const [isWithdrawing, setIsWithdrawing] = useAtom(isWithdrawingAtom)
    const [balance, setBalance] = useAtom(userSOLAmount)
    const { connection } = useConnection()
    const [status, setStatus] = useAtom(statusAtom)
    const [hasher] = useAtom(hasherAtom)

    const {
        publicKey,
    } = useWallet()

    const handleWithdraw = async () => {
        if (isWithdrawing || userUtxo == null) {
            return
        }
        if (isDepositing) {
            toastError('Wait till your deposit is finished')
            return
        }
        const amount = Number(withdrawAmount);
        if (isNaN(amount) || amount <= 0) {
            console.log('not a valid amount')
            return;
        }
        if (!receptAddress) {
            toastError(`Enter a valid Solana address`)
            return
        }
        if (amount > userUtxo) {
            toastError(`Can't withdraw more SOL than your balance`)
            return
        }
        let signed = await getAccountSign()
        if (!signed) {
            return
        }
        if (!hasher) {
            console.log('handleWithdraw: hasher not ready')
        }

        // start withdrawal
        setIsWithdrawing(true)
        try {
            let orgBalance = balance
            let recipient_address: PublicKey
            try {
                recipient_address = new PublicKey(receptAddress)
            } catch (e) {
                toastError('Enter a valid Solana address')
                setIsWithdrawing(false)
                return
            }
            setStatus(`(loading utxos...)`)
            let success = await withdraw(recipient_address, amount, signed, connection, setStatus, hasher)
            if (success) {
                let utxoChanged = await updateUtxo()
                if (!utxoChanged) {
                    console.log('Utxo not changed. Try again after 5 sec')
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    await updateUtxo()
                }
                if (publicKey) {
                    const lamports = await connection.getBalance(publicKey)
                    setBalance(lamports / LAMPORTS_PER_SOL)
                }
                if (success.isPartial) {
                    toastSuccess('Partial withdrawal successful')
                } else {
                    toastSuccess('Withdraw successful')
                }
                setWithdrawAmount('')
            }
        } catch (e) {
            console.log(e)
        }
        setReceptAddress('')
        setIsWithdrawing(false)
    }

    const handleMax = () => {
        if (isUpdatingUtxo) {
            return
        }
        setWithdrawAmount(userUtxo.toString())
    }

    const inputFields = <>
        <div style={{ position: "relative" }}>
            <div className="withdraw_max" onClick={handleMax}>MAX</div>
            <div style={{ position: "absolute", right: 10, top: 13, color: "#ccc" }}>SOL</div>
            <input className="input" placeholder='0.00' value={withdrawAmount} onChange={(e) => {
                const val = e.target.value;
                if (/^(?:\d+|\d+\.\d*)?$/.test(val)) {
                    setWithdrawAmount(val);
                }
            }} />
        </div>
        <div style={{ position: "relative", marginTop: 10 }}>
            <input className="input" placeholder='Solana recipient address' value={receptAddress} onChange={(e) => {
                setReceptAddress(e.target.value)
            }} />
        </div>
    </>
    if (!publicKey) {
        return inputFields
    }


    return <div>
        {inputFields}
        <div style={{ textAlign: "center", margin: '30px 0 10px 0' }}>Available to withdraw: {isUpdatingUtxo ? 'Loading..' : userUtxo.toFixed(9) + ' SOL'}</div>
        <button className='btn btn-red btn-lg btn-block' onClick={handleWithdraw} disabled={isWithdrawing ? true : false}>
            {isWithdrawing && <Spinner size={15} />}
            {isWithdrawing ? <span style={{ color: '#ccc' }}>Withdrawing</span> : 'Withdraw'}
        </button>
    </div>
}