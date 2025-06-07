'use client'
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import axios, { type AxiosResponse } from 'axios';
import BN from 'bn.js';
import { Keypair as UtxoKeypair } from '../models/keypair';
import { Utxo } from '../models/utxo';
import { EncryptionService } from './encryption';
//@ts-ignore
import * as ffjavascript from 'ffjavascript';
import { FETCH_UTXOS_GROUP_SIZE, PROGRAM_ID } from './constants';
import type { Signed } from './getAccountSign';

// Use type assertion for the utility functions (same pattern as in get_verification_keys.ts)
const utils = ffjavascript.utils as any;
const { unstringifyBigInts, leInt2Buff } = utils;


/**
 * Interface for the UTXO data returned from the API
 */
interface ApiUtxo {
    commitment: string;
    encrypted_output: string; // Hex-encoded encrypted UTXO data
    index: number;
    nullifier?: string; // Optional, might not be present for all UTXOs
}

/**
 * Interface for the API response format that includes count and encrypted_outputs
 */
interface ApiResponse {
    count: number;
    encrypted_outputs: string[];
}

function sleep(ms: number): Promise<string> {
    return new Promise(resolve => setTimeout(() => {
        resolve('ok')
    }, ms))
}

export function localstorageKey(key: PublicKey) {
    return key.toString().substring(0, 10)
}

let getMyUtxosPromise: Promise<Utxo[]> | null = null
let roundStartIndex = 0
let decryptionTaskFinished = 0;
/**
 * Fetch and decrypt all UTXOs for a user
 * @param signed The user's signature of message 'ZKCash Account Generation'
 * @param connection Solana connection to fetch on-chain commitment accounts
 * @param setStatus A global state updator. Set live status message showing on webpage
 * @returns Array of decrypted UTXOs that belong to the user
 */
export async function getMyUtxos(signed: Signed, connection: Connection, setStatus?: any, hasher?: any): Promise<Utxo[]> {
    if (!signed) {
        throw new Error('signed undefined')
    }
    if (!hasher) {
        throw new Error('getMyUtxos:no hasher')
    }
    if (!getMyUtxosPromise) {
        getMyUtxosPromise = (async () => {
            setStatus?.(`(loading utxos...)`)
            let valid_utxos: Utxo[] = []
            let valid_strings: string[] = []
            try {
                let offsetStr = localStorage.getItem('fetchUtxoOffset' + localstorageKey(signed.publicKey))
                if (offsetStr) {
                    roundStartIndex = Number(offsetStr)
                } else {
                    roundStartIndex = 0
                }
                decryptionTaskFinished = 0
                while (true) {
                    let offsetStr = localStorage.getItem('fetchUtxoOffset' + localstorageKey(signed.publicKey))
                    let fetch_utxo_offset = offsetStr ? Number(offsetStr) : 0
                    let fetch_utxo_end = fetch_utxo_offset + FETCH_UTXOS_GROUP_SIZE
                    let fetch_utxo_url = `https://api.privacycash.org/utxos/range?start=${fetch_utxo_offset}&end=${fetch_utxo_end}`
                    let fetched = await fetchUserUtxos(signed, connection, fetch_utxo_url, setStatus, hasher)
                    let am = 0
                    for (let [k, utxo] of fetched.utxos.entries()) {
                        if (utxo.amount.toNumber() > 0 && !await isUtxoSpent(connection, utxo)) {
                            console.log('debug utxo amout', fetched.encryptedOutputs[k], utxo.amount.toNumber())
                            am += utxo.amount.toNumber()
                            valid_utxos.push(utxo)
                            valid_strings.push(fetched.encryptedOutputs[k])
                        }
                    }
                    console.log('debug total: ', am / LAMPORTS_PER_SOL)
                    localStorage.setItem('fetchUtxoOffset' + localstorageKey(signed.publicKey), (fetch_utxo_offset + fetched.len).toString())
                    if (!fetched.hashMore) {
                        break
                    }
                    await sleep(100)
                }
            } finally {
                getMyUtxosPromise = null
            }
            // store valid strings
            valid_strings = [...new Set(valid_strings)];
            localStorage.setItem('encryptedOutputs' + localstorageKey(signed.publicKey), JSON.stringify(valid_strings))
            setStatus?.('')
            return valid_utxos
        })()
    }
    return getMyUtxosPromise
}

/**
 * Fetch and decrypt UTXOs from apiUrl
 * @param signed The user's signature of message 'ZKCash Account Generation'
 * @param connection Solana connection to fetch on-chain commitment accounts
 * @param apiUrl Optional custom API URL, defaults to 'https://api.privacycash.org/utxos'
 * @returns Array of decrypted UTXOs that belong to the user
 */
async function fetchUserUtxos(signed: Signed, connection: Connection, apiUrl: string, setStatus?: Function, hasher?: any): Promise<{
    encryptedOutputs: string[],
    utxos: Utxo[],
    hashMore: boolean,
    len: number
}> {

    try {
        if (!hasher) {
            throw new Error('fetchUserUtxos: no hashser')
        }
        // Initialize the light protocol hasher
        // const lightWasm = await getHasher()
        const lightWasm = hasher

        // Initialize the encryption service and generate encryption key from the keypair
        const encryptionService = new EncryptionService();
        encryptionService.deriveEncryptionKeyFromSignature(signed.signature);

        // Derive the UTXO keypair from the wallet keypair
        const utxoPrivateKey = encryptionService.deriveUtxoPrivateKey();
        const utxoKeypair = new UtxoKeypair(utxoPrivateKey, lightWasm);

        // Use default API URL if not provided
        const url = apiUrl || 'https://api.privacycash.org/utxos';
        console.log(`Using API endpoint: ${url}`);

        // Fetch all UTXOs from the API
        let encryptedOutputs: string[] = [];
        let response: AxiosResponse<any, any>
        try {
            response = await axios.get(url);
            // Log the raw response for debugging
            console.log(`API Response status: ${response.status}`);
            console.log(`Response type: ${typeof response.data}`);

            if (!response.data) {
                console.error('API returned empty data');
            } else if (Array.isArray(response.data)) {
                // Handle the case where the API returns an array of UTXOs
                const utxos: ApiUtxo[] = response.data;
                console.log(`Found ${utxos.length} total UTXOs in the system (array format)`);

                // Extract encrypted outputs from the array of UTXOs
                encryptedOutputs = utxos
                    .filter(utxo => utxo.encrypted_output)
                    .map(utxo => utxo.encrypted_output);
            } else if (typeof response.data === 'object' && response.data.encrypted_outputs) {
                // Handle the case where the API returns an object with encrypted_outputs array
                const apiResponse = response.data as ApiResponse;
                encryptedOutputs = apiResponse.encrypted_outputs;
                console.log(`Found ${apiResponse.count} total UTXOs in the system (object format)`);
            } else {
                console.error(`API returned unexpected data format: ${JSON.stringify(response.data).substring(0, 100)}...`);
            }

            // Log all encrypted outputs line by line
            console.log('\n=== ALL ENCRYPTED OUTPUTS ===');
            encryptedOutputs.forEach((output, index) => {
                console.log(`[${index + 1}] ${output}`);
            });
            console.log(`=== END OF ENCRYPTED OUTPUTS (${encryptedOutputs.length} total) ===\n`);

        } catch (apiError: any) {
            throw new Error(`API request failed: ${apiError.message}`);
        }

        // Try to decrypt each encrypted output
        const myUtxos: Utxo[] = [];
        const myEncryptedOutputs: string[] = [];
        console.log('Attempting to decrypt UTXOs...');
        let decryptionAttempts = 0;
        let successfulDecryptions = 0;

        let cachedStringNum = 0
        let cachedString = localStorage.getItem('encryptedOutputs' + localstorageKey(signed.publicKey))
        if (cachedString) {
            cachedStringNum = JSON.parse(cachedString).length
        }

        let decryptionTaskTotal = response.data.total + cachedStringNum - roundStartIndex;
        // check fetched string
        for (let i = 0; i < encryptedOutputs.length; i++) {
            const encryptedOutput = encryptedOutputs[i];
            setStatus?.(`(decrypting utxo: ${decryptionTaskFinished + 1}/${decryptionTaskTotal}...)`)
            let dres = await decrypt_output(encryptedOutput, encryptionService, utxoKeypair, lightWasm, connection)
            decryptionTaskFinished++
            if (dres.status == 'decrypted' && dres.utxo) {
                console.log(`got a descripted utxo from fetching`)
                myUtxos.push(dres.utxo)
                myEncryptedOutputs.push(encryptedOutput)
            }
        }
        // check cached string when no more fetching tasks
        if (!response.data.hasMore) {
            if (cachedString) {
                let cachedEncryptedOutputs = JSON.parse(cachedString)
                console.log('cachedEncryptedOutputs:', cachedEncryptedOutputs.length)
                for (let encryptedOutput of cachedEncryptedOutputs) {
                    setStatus?.(`(decrypting utxo: ${decryptionTaskFinished + 1}/${decryptionTaskTotal}...)`)
                    let dres = await decrypt_output(encryptedOutput, encryptionService, utxoKeypair, lightWasm, connection)
                    decryptionTaskFinished++
                    if (dres.status == 'decrypted' && dres.utxo) {
                        console.log(`got a descripted utxo from caching `)
                        myUtxos.push(dres.utxo)
                        myEncryptedOutputs.push(encryptedOutput)
                    }
                }
            }
        }

        console.log(`\nDecryption summary: ${successfulDecryptions} successful out of ${decryptionAttempts} attempts`);
        console.log(`Found ${myUtxos.length} UTXOs belonging to your keypair in ${encryptedOutputs.length} total UTXOs`);

        return { encryptedOutputs: myEncryptedOutputs, utxos: myUtxos, hashMore: response.data.hasMore, len: encryptedOutputs.length };
    } catch (error: any) {
        console.error('Error fetching UTXOs:', error.message);
        return { encryptedOutputs: [], utxos: [], hashMore: false, len: 0 };
    }
}

/**
 * Check if a UTXO has been spent
 * @param connection Solana connection
 * @param utxo The UTXO to check
 * @returns Promise<boolean> true if spent, false if unspent
 */
export async function isUtxoSpent(connection: Connection, utxo: Utxo): Promise<boolean> {
    try {
        // Get the nullifier for this UTXO
        const nullifier = await utxo.getNullifier();
        console.log(`Checking if UTXO with nullifier ${nullifier} is spent`);

        // Convert decimal nullifier string to byte array (same format as in proofs)
        // This matches how commitments are handled and how the Rust code expects the seeds
        const nullifierBytes = Array.from(
            leInt2Buff(unstringifyBigInts(nullifier), 32)
        ).reverse() as number[];

        // Try both nullifier0 and nullifier1 seeds since we don't know which one it would use
        let isSpent = false;

        // Try nullifier0 seed
        try {
            const [nullifier0PDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("nullifier0"), Buffer.from(nullifierBytes)],
                PROGRAM_ID
            );

            console.log(`Derived nullifier0 PDA: ${nullifier0PDA.toBase58()}`);
            const nullifier0Account = await connection.getAccountInfo(nullifier0PDA);
            if (nullifier0Account !== null) {
                isSpent = true;
                console.log(`UTXO is spent (nullifier0 account exists)`);
                return isSpent;
            }
        } catch (e) {
            // PDA derivation failed for nullifier0, continue to nullifier1
        }

        // Try nullifier1 seed
        try {
            const [nullifier1PDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("nullifier1"), Buffer.from(nullifierBytes)],
                PROGRAM_ID
            );

            console.log(`Derived nullifier1 PDA: ${nullifier1PDA.toBase58()}`);
            const nullifier1Account = await connection.getAccountInfo(nullifier1PDA);
            if (nullifier1Account !== null) {
                isSpent = true;
                console.log(`UTXO is spent (nullifier1 account exists)`);
                return isSpent;
            }
        } catch (e) {
            // PDA derivation failed for nullifier1 as well
        }

        console.log(`UTXO is unspent (no nullifier accounts found)`);
        return false;
    } catch (error) {
        console.error('Error checking if UTXO is spent:', error);
        return true; // Default to spent in case of errors
    }
}

// Calculate and display total balance
export function getBalanceFromUtxos(utxos: Utxo[]): number {
    const totalBalance = utxos.reduce((sum, utxo) => sum.add(utxo.amount), new BN(0));
    const LAMPORTS_PER_SOL = new BN(1000000000); // 1 billion lamports = 1 SOL
    const balanceInSol = totalBalance.div(LAMPORTS_PER_SOL);
    const remainderLamports = totalBalance.mod(LAMPORTS_PER_SOL);
    const balanceInSolWithDecimals = balanceInSol.toNumber() + remainderLamports.toNumber() / 1000000000;
    return balanceInSolWithDecimals
}

// Decrypt single output to Utxo
type DecryptRes = { status: 'decrypted' | 'skipped' | 'unDecrypted', utxo?: Utxo }
async function decrypt_output(
    encryptedOutput: string,
    encryptionService: EncryptionService,
    utxoKeypair: UtxoKeypair,
    lightWasm: any,
    connection: Connection
): Promise<DecryptRes> {
    let res: DecryptRes = { status: 'unDecrypted' }
    try {
        if (!encryptedOutput) {
            return { status: 'skipped' }
        }

        // Try to decrypt the UTXO
        res.utxo = await encryptionService.decryptUtxo(
            encryptedOutput,
            utxoKeypair,
            lightWasm
        );

        // If we got here, decryption succeeded, so this UTXO belongs to the user
        res.status = 'decrypted'

        // Get the real index from the on-chain commitment account
        try {
            const commitment = await res.utxo.getCommitment();
            console.log(`Getting real index for commitment: ${commitment}`);

            // Convert decimal commitment string to byte array (same format as in proofs)
            const commitmentBytes = Array.from(
                leInt2Buff(unstringifyBigInts(commitment), 32)
            ).reverse() as number[];

            // Derive the commitment PDA (could be either commitment0 or commitment1)
            // We'll try both seeds since we don't know which one it is
            let commitmentAccount = null;
            let realIndex = null;
            // Try commitment0 seed
            try {
                const [commitment0PDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("commitment0"), Buffer.from(commitmentBytes)],
                    PROGRAM_ID
                );

                const account0Info = await connection.getAccountInfo(commitment0PDA);
                if (account0Info) {
                    // Parse the index from the account data according to CommitmentAccount structure:
                    // 0-8: Anchor discriminator
                    // 8-40: commitment (32 bytes)  
                    // 40-44: encrypted_output length (4 bytes)
                    // 44-44+len: encrypted_output data
                    // 44+len-52+len: index (8 bytes)
                    const encryptedOutputLength = account0Info.data.readUInt32LE(40);
                    const indexOffset = 44 + encryptedOutputLength;
                    const indexBytes = account0Info.data.slice(indexOffset, indexOffset + 8);
                    realIndex = new BN(indexBytes, 'le').toNumber();
                    console.log(`Found commitment0 account with index: ${realIndex}`);
                }
            } catch (e) {
                // Try commitment1 seed if commitment0 fails
                try {
                    const [commitment1PDA] = PublicKey.findProgramAddressSync(
                        [Buffer.from("commitment1"), Buffer.from(commitmentBytes)],
                        PROGRAM_ID
                    );

                    const account1Info = await connection.getAccountInfo(commitment1PDA);
                    if (account1Info) {
                        // Parse the index from the account data according to CommitmentAccount structure
                        const encryptedOutputLength = account1Info.data.readUInt32LE(40);
                        const indexOffset = 44 + encryptedOutputLength;
                        const indexBytes = account1Info.data.slice(indexOffset, indexOffset + 8);
                        realIndex = new BN(indexBytes, 'le').toNumber();
                        console.log(`Found commitment1 account with index: ${realIndex}`);
                    }
                } catch (e2) {
                    console.log(`Could not find commitment account for ${commitment}, using encrypted index: ${res.utxo.index}`);
                }
            }

            // Update the UTXO with the real index if we found it
            if (realIndex !== null) {
                const oldIndex = res.utxo.index;
                res.utxo.index = realIndex;
                console.log(`Updated UTXO index from ${oldIndex} to ${realIndex}`);
            }

        } catch (error: any) {
            console.log(`Failed to get real index for UTXO: ${error.message}`);
        }
    } catch (error: any) {
        // Log error but continue - this UTXO doesn't belong to the user
        console.log(`✗ Failed to decrypt: ${error.message.split('\n')[0]}`);
    }
    return res
}