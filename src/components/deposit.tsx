'use client'
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useAtom } from 'jotai';
import { useEffect, useState } from "react";
import { hasherAtom, isDepositingAtom, isWithdrawingAtom, statusAtom, userSOLAmount } from "../utils/atoms";
import { deposit } from "../utils/deposit";
import { getAccountSign } from "../utils/getAccountSign";
import Spinner from "./spinner";
import { toastError, toastSuccess } from "./toast";
export function Deposit({ updateUtxo }: { updateUtxo: Function }) {
    const {
        publicKey,
    } = useWallet()

    const [balance, setBalance] = useAtom(userSOLAmount)
    const [isDepositing, setIsDepositing] = useAtom(isDepositingAtom)
    const [isWithdrawing, setIsWithdrawing] = useAtom(isWithdrawingAtom)
    const { connection } = useConnection()
    const [status, setStatus] = useAtom(statusAtom)
    const [depositAmount, setDepositAmount] = useState('')
    const [hasher] = useAtom(hasherAtom)
    useEffect(() => {
        const fetchBalance = async () => {
            if (publicKey) {
                const lamports = await connection.getBalance(publicKey)
                setBalance(lamports / LAMPORTS_PER_SOL)
            }
        }
        fetchBalance()
    }, [publicKey, connection])

    const handleDeposit = async () => {
        if (isDepositing || balance == null) {
            return
        }
        if (isWithdrawing) {
            toastError(`Wait till your withdraw is finished`)
            return
        }
        const amount = Number(depositAmount);
        if (isNaN(amount) || amount <= 0) {
            console.log('not a valid amount')
            return;
        }
        if (amount > balance) {
            toastError(`Can't deposit more SOL than your balance`)
            return
        }
        setIsDepositing(true)
        try {
            let signed = await getAccountSign()
            if (!signed) {
                return
            }
            let success = await deposit(amount, signed, connection, setStatus, hasher)
            if (success) {
                if (publicKey) {
                    const lamports = await connection.getBalance(publicKey)
                    setBalance(lamports / LAMPORTS_PER_SOL)
                }
                toastSuccess('Deposit successful')
                setDepositAmount('')
            }
        } catch (e) {
            console.log('deposit err: ', e)
        }
        setIsDepositing(false)
        // update Utxo
        updateUtxo()
    }

    const amountInput = <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", right: 10, top: 13, color: "#ccc" }}>SOL</div>
        <input className="input" placeholder='0.00' value={depositAmount} onChange={(e) => {
            const val = e.target.value;
            if (/^(?:\d+|\d+\.\d*)?$/.test(val)) {
                setDepositAmount(val);
            }
        }} />
    </div>
    if (!publicKey) {
        return amountInput
    }
    return <>
        {amountInput}
        <div style={{ textAlign: "center", margin: '30px 0 10px 0' }}>Available to deposit: {balance !== null ? `${balance} SOL` : 'Loading...'}</div>
        <button className='btn btn-green btn-lg btn-block' onClick={handleDeposit} disabled={isDepositing ? true : false}>
            {isDepositing && <Spinner size={15} />}
            {isDepositing ? <span style={{ color: '#ccc' }}>Depositing</span> : 'Deposit'}
        </button>
    </>
}