'use client'
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"
import { useAtom } from "jotai"
import { ChangeEvent, useState } from "react"
import { hasherAtom, isDepositingAtom, isWithdrawingAtom, statusAtom, updatingUtxoAtom, userSOLAmount, userUtxoAmount } from "../utils/atoms"
import { getAccountSign } from "../utils/getAccountSign"
import { withdraw } from "../utils/withdraw"
import Spinner from "./spinner"
import { toastError, toastSuccess } from "./toast"
import WalletConnectButton from './walletConnectBtn'
import { Icon } from "./ui/icons"
import { WITHDRAW_FEE_RATE } from "@/utils/constants"
import { Modal } from "./ui/modal"
import { Deposit } from "./deposit"

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
    const [totalFees, setTotalFees] = useState(0)
    // modal
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

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

    const handleChangeAmount = (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^(?:\d+|\d+\.\d*)?$/.test(val)) {
            setWithdrawAmount(val);
            let amount = Number(val)
            let amount_in_lamports = amount * LAMPORTS_PER_SOL
            let fee_amount_in_lamports = Math.floor(amount_in_lamports * WITHDRAW_FEE_RATE)
            let totalFees = fee_amount_in_lamports / LAMPORTS_PER_SOL
            console.log('totalFees:', totalFees, val)
            setTotalFees(totalFees)

        }
    }

    const balanceBox = <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
        <div>Private balance: {isUpdatingUtxo ? 'Loading..' : userUtxo.toFixed(9) + ' SOL'}</div>
        <div>
            <button className="btn btn-outline btn-sm" onClick={openModal}><Icon name="plus" /> <span>Top up</span></button>
        </div>
    </div>

    return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {isModalOpen && (
            <Modal onClose={closeModal} closeOnBackdropClick={false}>
                <Deposit updateUtxo={updateUtxo} closeModal={closeModal} />
            </Modal>
        )}

        <div style={{ fontSize: '1.2em' }}>
            Send Privately
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: "relative" }}>
                <div className="withdraw_max" onClick={handleMax}>MAX</div>
                <div style={{ position: "absolute", right: 10, top: 13, color: "#ccc" }}>SOL</div>
                <input className="input" placeholder='0.00' value={withdrawAmount} onChange={handleChangeAmount} />
            </div>
            {publicKey && balanceBox}
        </div>
        <div style={{ position: "relative", marginTop: 10 }}>
            <input className="input" placeholder='Recipient address' value={receptAddress} onChange={(e) => {
                setReceptAddress(e.target.value)
            }} />
        </div>

        {publicKey && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9em', opacity: 0.6 }}>
            <div>Total fees</div>
            <div>${totalFees.toFixed(9)}</div>
        </div>}

        {publicKey ?
            <button className='btn btn-green btn-lg btn-block' onClick={handleWithdraw} disabled={isWithdrawing ? true : false}>
                {isWithdrawing && <Spinner size={15} />}
                {isWithdrawing ? <span style={{ color: '#ccc' }}>Sending</span> : 'Send'}
            </button> :
            <>
                <WalletConnectButton size='lg' />
                <div style={{ height: 10 }}></div>
            </>
        }
    </div>
}