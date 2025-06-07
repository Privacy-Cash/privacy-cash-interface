'use client'
import type { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const wallets = [
    { name: 'Phantom', check: (p: any) => p?.isPhantom },
    { name: 'Backpack', check: (p: any) => p?.isBackpack },
    { name: 'Solflare', check: (p: any) => p?.isSolflare },
    { name: 'Glow', check: (p: any) => p?.isGlow },
];

export type Signed = {
    publicKey: PublicKey,
    signature: Uint8Array
}

export async function getAccountSign(): Promise<Signed | undefined> {
    if (!('solana' in window)) {
        return
    }
    const anyWindow = window as any;
    let selectedProvider: any = null;
    let walletName = '';
    for (const wallet of wallets) {
        if (wallet.check(anyWindow.solana)) {
            selectedProvider = anyWindow.solana;
            walletName = wallet.name;
            break;
        }

        if (wallet.name === 'Backpack' && anyWindow.backpack?.solana?.isBackpack) {
            selectedProvider = anyWindow.backpack.solana;
            walletName = 'Backpack';
            break;
        }

        if (wallet.name === 'Solflare' && anyWindow.solflare?.isSolflare) {
            selectedProvider = anyWindow.solflare;
            walletName = 'Solflare';
            break;
        }

        if (wallet.name === 'Glow' && anyWindow.glow?.solana?.isGlow) {
            selectedProvider = anyWindow.glow.solana;
            walletName = 'Glow';
            break;
        }
    }
    if (!selectedProvider) {
        throw new Error('no connected wallet provider found')
    }

    const message = `Privacy Money account sign in`
    const encodedMessage = new TextEncoder().encode(message)

    if (!selectedProvider.publicKey) {
        return
    }
    // key to store signature in localStorage
    const cacheKey = `zkcash-signature-${selectedProvider.publicKey.toBase58()}`
    const cachedSignatureBase58 = localStorage.getItem(cacheKey)

    if (cachedSignatureBase58) {
        try {
            const cachedSignature = bs58.decode(cachedSignatureBase58)
            if (cachedSignature instanceof Uint8Array) {
                console.log('got signature from localStorage')
                return { signature: cachedSignature, publicKey: selectedProvider.publicKey }
            }
        } catch (err) {
            console.warn('Failed to decode cached signature, ignoring cache.')
        }
    }

    // ask for sign
    let signature: Uint8Array
    try {
        signature = await selectedProvider.signMessage(encodedMessage)
    } catch (err: any) {
        if (err instanceof Error && err.message?.toLowerCase().includes('user rejected')) {
            throw new Error('User rejected the signature request')
        }
        throw new Error('Failed to sign message: ' + err.message)
    }

    // If wallet.signMessage returned an object, extract `signature`
    // @ts-ignore
    if (signature.signature) {
        // @ts-ignore
        signature = signature.signature
    }

    if (!(signature instanceof Uint8Array)) {
        console.log('signature is not an Uint8Array type')
        return
    }

    // cache to localStorage
    const signatureBase58 = bs58.encode(signature)
    localStorage.setItem(cacheKey, signatureBase58)

    return { signature, publicKey: selectedProvider.publicKey }
}
