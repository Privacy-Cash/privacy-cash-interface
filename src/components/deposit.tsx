'use client'
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useAtom } from 'jotai';
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { hasherAtom, isDepositingAtom, isWithdrawingAtom, statusAtom, userSOLAmount } from "../utils/atoms";
import { deposit } from "../utils/deposit";
import { getAccountSign } from "../utils/getAccountSign";
import Spinner from "./spinner";
import { toastError, toastSuccess } from "./toast";
import { DEPOSIT_FEE_RATE, WITHDRAW_FEE_RATE } from "@/utils/constants";
export function Deposit({ updateUtxo, closeModal }: { updateUtxo: Function, closeModal: Function }) {
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
    const [totalFees, setTotalFees] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        inputRef.current?.focus();
    }, []);
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
                closeModal()
            }
        } catch (e) {
            console.log('deposit err: ', e)
        }
        setIsDepositing(false)
        // update Utxo
        updateUtxo()
    }

    const handleChangeAmount = (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^(?:\d+|\d+\.\d*)?$/.test(val)) {
            setDepositAmount(val);
            let amount = Number(val)
            let amount_in_lamports = amount * LAMPORTS_PER_SOL
            let fee_amount_in_lamports = Math.floor(amount_in_lamports * DEPOSIT_FEE_RATE)
            let totalFees = fee_amount_in_lamports / LAMPORTS_PER_SOL
            console.log('totalFees:', totalFees, val)
            setTotalFees(totalFees)
        }
    }

    if (!publicKey) {
        return <div>not connected</div>
    }

    return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.9em', color: '#999', padding: '10px 0' }}>
                Add funds to your private balance so you're able to send privately.
            </div>
        </div>
        <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", right: 10, top: 13, color: "#ccc" }}>SOL</div>
            <input ref={inputRef} className="input" placeholder='0.00' value={depositAmount} onChange={handleChangeAmount} />
        </div>
        <div style={{ margin: '30px 0 10px 0', opacity: 0.7 }}>Wallet balance: {balance !== null ? `${balance} SOL` : 'Loading...'}</div>
        {totalFees > 0 &&
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9em', opacity: 0.6 }}>
                <div>Protocol fees</div>
                <div>${totalFees.toFixed(4)}</div>
            </div>
        }
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button className='btn btn-green btn-lg btn-block' onClick={handleDeposit} disabled={isDepositing ? true : false}>
                {isDepositing && <Spinner size={15} />}
                {isDepositing ? <span style={{ color: '#ccc' }}>Depositing</span> : 'Top up'}
            </button>
            <div style={{ fontSize: '0.8em', textAlign: 'center', height: 17, padding: '7px 0', display: publicKey ? 'block' : 'none' }}>
                <center>{status}</center>
            </div>
        </div>
    </div>
}