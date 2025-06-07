'use client'
import { ComputeBudgetProgram, Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import { Keypair as UtxoKeypair } from '../models/keypair';
import { Utxo } from '../models/utxo';
import { CIRCUIT_PATH, FIELD_SIZE, PROGRAM_ID } from './constants';
import { EncryptionService, serializeProofAndExtData } from './encryption';
import type { Signed } from './getAccountSign';

import { getExtDataHash } from './getExtDataHash';
import { getMyUtxos, isUtxoSpent } from './getMyUtxos';
import { MerkleTree } from './merkle_tree';
import { parseProofToBytesArray, parseToBytesArray, prove } from './prover';
import { Buffer } from 'buffer';
import { URL } from 'node:url'
// Function to query remote tree state from indexer API
async function queryRemoteTreeState(): Promise<{ root: string, nextIndex: number }> {
    try {
        console.log('Fetching Merkle root and nextIndex from API...');
        const response = await fetch('https://api.privacycash.org/merkle/root');
        if (!response.ok) {
            throw new Error(`Failed to fetch Merkle root and nextIndex: ${response.status} ${response.statusText}`);
        }
        const data = await response.json() as { root: string, nextIndex: number };
        console.log(`Fetched root from API: ${data.root}`);
        console.log(`Fetched nextIndex from API: ${data.nextIndex}`);
        return data;
    } catch (error) {
        console.error('Failed to fetch root and nextIndex from API:', error);
        throw error;
    }
}

// Function to fetch Merkle proof from API for a given commitment
async function fetchMerkleProof(commitment: string): Promise<{ pathElements: string[], pathIndices: number[] }> {
    try {
        console.log(`Fetching Merkle proof for commitment: ${commitment}`);
        const response = await fetch(`https://api.privacycash.org/merkle/proof/${commitment}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch Merkle proof: ${response.status} ${response.statusText}`);
        }
        const data = await response.json() as { pathElements: string[], pathIndices: number[] };
        console.log(`✓ Fetched Merkle proof with ${data.pathElements.length} elements`);
        return data;
    } catch (error) {
        console.error(`Failed to fetch Merkle proof for commitment ${commitment}:`, error);
        throw error;
    }
}

// Find nullifier PDAs for the given proof
function findNullifierPDAs(proof: any) {
    const [nullifier0PDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("nullifier0"), Buffer.from(proof.inputNullifiers[0])],
        PROGRAM_ID
    );

    const [nullifier1PDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("nullifier1"), Buffer.from(proof.inputNullifiers[1])],
        PROGRAM_ID
    );

    return { nullifier0PDA, nullifier1PDA };
}

// Find commitment PDAs for the given proof
function findCommitmentPDAs(proof: any) {
    const [commitment0PDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("commitment0"), Buffer.from(proof.outputCommitments[0])],
        PROGRAM_ID
    );

    const [commitment1PDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("commitment1"), Buffer.from(proof.outputCommitments[1])],
        PROGRAM_ID
    );

    return { commitment0PDA, commitment1PDA };
}


export async function deposit(amount_in_sol: number, signed: Signed, connection: Connection, setStatus?: Function, hasher?: any) {
    const amount_in_lamports = amount_in_sol * LAMPORTS_PER_SOL
    const fee_amount_in_lamports = Math.floor(amount_in_lamports * 25 / 10000)
    try {
        // Initialize the light protocol hasher
        // let lightWasm = await getHasher()
        let lightWasm = hasher
        // Initialize the encryption service
        const encryptionService = new EncryptionService();

        // Use hardcoded deployer public key
        const deployer = new PublicKey('1NpWc4q6VYJmg9V3TQenvHMTr8qiDDrrT4TV27SxQms');
        console.log('Using hardcoded deployer public key');
        // Generate encryption key from the user signature
        encryptionService.deriveEncryptionKeyFromSignature(signed.signature);
        console.log('Encryption key generated from user keypair');

        console.log(`Deployer wallet: ${deployer.toString()}`);
        console.log(`User wallet: ${signed.publicKey.toString()}`);

        // Check wallet balance
        const balance = await connection.getBalance(signed.publicKey);
        console.log(`Wallet balance: ${balance / 1e9} SOL`);

        if (balance < amount_in_lamports + fee_amount_in_lamports) {
            console.error(`Insufficient balance: ${balance / 1e9} SOL. Need at least ${(amount_in_lamports + fee_amount_in_lamports) / 1e9} SOL.`);
            return;
        }

        // Derive PDA (Program Derived Addresses) for the tree account and other required accounts
        const [treeAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from('merkle_tree'), deployer.toBuffer()],
            PROGRAM_ID
        );

        const [feeRecipientAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from('fee_recipient'), deployer.toBuffer()],
            PROGRAM_ID
        );

        const [treeTokenAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from('tree_token'), deployer.toBuffer()],
            PROGRAM_ID
        );

        console.log('Using PDAs:');
        console.log(`Tree Account: ${treeAccount.toString()}`);
        console.log(`Fee Recipient Account: ${feeRecipientAccount.toString()}`);
        console.log(`Tree Token Account: ${treeTokenAccount.toString()}`);

        // Create the merkle tree with the pre-initialized poseidon hash
        const tree = new MerkleTree(20, lightWasm);

        // Initialize root and nextIndex variables
        let root: string;
        let currentNextIndex: number;

        try {
            const data = await queryRemoteTreeState();
            root = data.root;
            currentNextIndex = data.nextIndex;
        } catch (error) {
            console.error('Failed to fetch root and nextIndex from API, exiting');
            return; // Return early without a fallback
        }

        console.log(`Using tree root: ${root}`);
        console.log(`New UTXOs will be inserted at indices: ${currentNextIndex} and ${currentNextIndex + 1}`);

        // Generate a deterministic private key derived from the wallet keypair
        const utxoPrivateKey = encryptionService.deriveUtxoPrivateKey();

        // Create a UTXO keypair that will be used for all inputs and outputs
        const utxoKeypair = new UtxoKeypair(utxoPrivateKey, lightWasm);
        console.log('Using wallet-derived UTXO keypair for deposit');

        // Fetch existing UTXOs for this user
        console.log('\nFetching existing UTXOs...');
        const allUtxos = await getMyUtxos(signed, connection, setStatus, hasher);
        console.log(`Found ${allUtxos.length} total UTXOs`);

        // Filter out zero-amount UTXOs (dummy UTXOs that can't be spent)
        const nonZeroUtxos = allUtxos.filter(utxo => utxo.amount.gt(new BN(0)));
        console.log(`Found ${nonZeroUtxos.length} non-zero UTXOs`);

        // Check which non-zero UTXOs are unspent
        console.log('Checking which UTXOs are unspent...');
        const utxoSpentStatuses = await Promise.all(
            nonZeroUtxos.map(utxo => isUtxoSpent(connection, utxo))
        );

        // Filter to only include unspent UTXOs
        const existingUnspentUtxos = nonZeroUtxos.filter((utxo, index) => !utxoSpentStatuses[index]);
        console.log(`Found ${existingUnspentUtxos.length} unspent UTXOs available for spending`);

        // Calculate output amounts and external amount based on scenario
        let extAmount: number;
        let outputAmount: string;

        // Create inputs based on whether we have existing UTXOs
        let inputs: Utxo[];
        let inputMerklePathIndices: number[];
        let inputMerklePathElements: string[][];

        if (existingUnspentUtxos.length === 0) {
            // Scenario 1: Fresh deposit with dummy inputs - add new funds to the system
            extAmount = amount_in_lamports;
            outputAmount = new BN(amount_in_lamports).sub(new BN(fee_amount_in_lamports)).toString();

            console.log(`Fresh deposit scenario (no existing UTXOs):`);
            console.log(`External amount (deposit): ${extAmount}`);
            console.log(`Fee amount: ${fee_amount_in_lamports}`);
            console.log(`Output amount: ${outputAmount}`);

            // Use two dummy UTXOs as inputs
            inputs = [
                new Utxo({
                    lightWasm,
                    keypair: utxoKeypair
                }),
                new Utxo({
                    lightWasm,
                    keypair: utxoKeypair
                })
            ];

            // Both inputs are dummy, so use mock indices and zero-filled Merkle paths
            inputMerklePathIndices = inputs.map((input) => input.index || 0);
            inputMerklePathElements = inputs.map(() => {
                return [...new Array(tree.levels).fill("0")];
            });
        } else {
            // Scenario 2: Deposit that consolidates with existing UTXO
            const firstUtxo = existingUnspentUtxos[0];
            const firstUtxoAmount = firstUtxo.amount;
            const secondUtxoAmount = existingUnspentUtxos.length > 1 ? existingUnspentUtxos[1].amount : new BN(0);
            extAmount = amount_in_lamports; // Still depositing new funds

            // Output combines existing UTXO amount + new deposit amount - fee
            outputAmount = firstUtxoAmount.add(secondUtxoAmount).add(new BN(amount_in_lamports)).sub(new BN(fee_amount_in_lamports)).toString();

            console.log(`Deposit with consolidation scenario:`);
            console.log(`First existing UTXO amount: ${firstUtxoAmount.toString()}`);
            if (secondUtxoAmount.gt(new BN(0))) {
                console.log(`Second existing UTXO amount: ${secondUtxoAmount.toString()}`);
            }
            console.log(`New deposit amount: ${amount_in_lamports}`);
            console.log(`Fee amount: ${fee_amount_in_lamports}`);
            console.log(`Output amount (existing UTXOs + deposit - fee): ${outputAmount}`);

            console.log(`External amount (deposit): ${extAmount}`);

            console.log('\nFirst UTXO to be consolidated:');
            await firstUtxo.log();

            // Use first existing UTXO as first input, dummy UTXO as second input
            const secondUtxo = existingUnspentUtxos.length > 1 ? existingUnspentUtxos[1] : new Utxo({
                lightWasm,
                keypair: utxoKeypair,
                amount: '0'
            });

            inputs = [
                firstUtxo, // Use the first existing UTXO
                secondUtxo // Use second UTXO if available, otherwise dummy
            ];

            // Fetch Merkle proof for the first (real) UTXO
            const firstUtxoCommitment = await firstUtxo.getCommitment();
            const firstUtxoMerkleProof = await fetchMerkleProof(firstUtxoCommitment);

            // Use the real pathIndices from API for first input, mock index for second input
            inputMerklePathIndices = [
                firstUtxo.index || 0, // Use the real UTXO's index  
                secondUtxo.amount.gt(new BN(0)) ? (secondUtxo.index || 0) : 0 // Real UTXO index or dummy
            ];

            let secondUtxoMerkleProof;
            if (secondUtxo.amount.gt(new BN(0))) {
                // Second UTXO is real, fetch its proof
                const secondUtxoCommitment = await secondUtxo.getCommitment();
                secondUtxoMerkleProof = await fetchMerkleProof(secondUtxoCommitment);
                console.log('\nSecond UTXO to be consolidated:');
                await secondUtxo.log();
            }

            // Create Merkle path elements: real proof for first input, zeros for second input
            inputMerklePathElements = [
                firstUtxoMerkleProof.pathElements, // Real Merkle proof for first existing UTXO
                secondUtxo.amount.gt(new BN(0)) ? secondUtxoMerkleProof!.pathElements : [...new Array(tree.levels).fill("0")] // Real proof or zero-filled for dummy
            ];

            console.log(`Using first UTXO with amount: ${firstUtxo.amount.toString()} and index: ${firstUtxo.index}`);
            console.log(`Using second ${secondUtxo.amount.gt(new BN(0)) ? 'UTXO' : 'dummy UTXO'} with amount: ${secondUtxo.amount.toString()}${secondUtxo.amount.gt(new BN(0)) ? ` and index: ${secondUtxo.index}` : ''}`);
            console.log(`First UTXO Merkle proof path indices from API: [${firstUtxoMerkleProof.pathIndices.join(', ')}]`);
            if (secondUtxo.amount.gt(new BN(0))) {
                console.log(`Second UTXO Merkle proof path indices from API: [${secondUtxoMerkleProof!.pathIndices.join(', ')}]`);
            }
        }

        const publicAmountForCircuit = new BN(extAmount).sub(new BN(fee_amount_in_lamports)).add(FIELD_SIZE).mod(FIELD_SIZE);
        console.log(`Public amount calculation: (${extAmount} - ${fee_amount_in_lamports} + FIELD_SIZE) % FIELD_SIZE = ${publicAmountForCircuit.toString()}`);

        // Create outputs for the transaction with the same shared keypair
        const outputs = [
            new Utxo({
                lightWasm,
                amount: outputAmount,
                keypair: utxoKeypair,
                index: currentNextIndex // This UTXO will be inserted at currentNextIndex
            }), // Output with value (either deposit amount minus fee, or input amount minus fee)
            new Utxo({
                lightWasm,
                amount: '0',
                keypair: utxoKeypair,
                index: currentNextIndex + 1 // This UTXO will be inserted at currentNextIndex + 1
            }) // Empty UTXO
        ];

        // Verify this matches the circuit balance equation: sumIns + publicAmount = sumOuts
        const sumIns = inputs.reduce((sum, input) => sum.add(input.amount), new BN(0));
        const sumOuts = outputs.reduce((sum, output) => sum.add(output.amount), new BN(0));
        console.log(`Circuit balance check: sumIns(${sumIns.toString()}) + publicAmount(${publicAmountForCircuit.toString()}) should equal sumOuts(${sumOuts.toString()})`);

        // Convert to circuit-compatible format
        const publicAmountCircuitResult = sumIns.add(publicAmountForCircuit).mod(FIELD_SIZE);
        console.log(`Balance verification: ${sumIns.toString()} + ${publicAmountForCircuit.toString()} (mod FIELD_SIZE) = ${publicAmountCircuitResult.toString()}`);
        console.log(`Expected sum of outputs: ${sumOuts.toString()}`);
        console.log(`Balance equation satisfied: ${publicAmountCircuitResult.eq(sumOuts)}`);

        // Generate nullifiers and commitments
        const inputNullifiers = await Promise.all(inputs.map(x => x.getNullifier()));
        const outputCommitments = await Promise.all(outputs.map(x => x.getCommitment()));

        // Save original commitment and nullifier values for verification
        console.log('\n=== UTXO VALIDATION ===');
        console.log('Output 0 Commitment:', outputCommitments[0]);
        console.log('Output 1 Commitment:', outputCommitments[1]);

        // Encrypt the UTXO data using a compact format that includes the keypair
        console.log('\nEncrypting UTXOs with keypair data...');
        const encryptedOutput1 = encryptionService.encryptUtxo(outputs[0]);
        const encryptedOutput2 = encryptionService.encryptUtxo(outputs[1]);

        console.log(`\nOutput[0] (with value):`);
        await outputs[0].log();
        console.log(`\nOutput[1] (empty):`);
        await outputs[1].log();

        console.log(`\nEncrypted output 1 size: ${encryptedOutput1.length} bytes`);
        console.log(`Encrypted output 2 size: ${encryptedOutput2.length} bytes`);
        console.log(`Total encrypted outputs size: ${encryptedOutput1.length + encryptedOutput2.length} bytes (this is just the data size, not the count)`);

        // Test decryption to verify commitment values match
        console.log('\n=== TESTING DECRYPTION ===');
        console.log('Decrypting output 1 to verify commitment matches...');
        const decryptedUtxo1 = await encryptionService.decryptUtxo(encryptedOutput1, utxoKeypair, lightWasm);
        const decryptedCommitment1 = await decryptedUtxo1.getCommitment();
        console.log('Original commitment:', outputCommitments[0]);
        console.log('Decrypted commitment:', decryptedCommitment1);
        console.log('Commitment matches:', outputCommitments[0] === decryptedCommitment1);

        // Create the deposit ExtData with real encrypted outputs
        const extData = {
            recipient: signed.publicKey,
            extAmount: new BN(extAmount),
            encryptedOutput1: encryptedOutput1,
            encryptedOutput2: encryptedOutput2,
            fee: new BN(fee_amount_in_lamports)
        };

        // Calculate the extDataHash with the encrypted outputs
        const calculatedExtDataHash = getExtDataHash(extData);

        // Create the input for the proof generation
        const input = {
            // Common transaction data
            root: root,
            inputNullifier: inputNullifiers, // Use resolved values instead of Promise objects
            outputCommitment: outputCommitments, // Use resolved values instead of Promise objects
            publicAmount: publicAmountForCircuit.toString(), // Use proper field arithmetic result
            extDataHash: calculatedExtDataHash,

            // Input UTXO data (UTXOs being spent) - ensure all values are in decimal format
            inAmount: inputs.map(x => x.amount.toString(10)),
            inPrivateKey: inputs.map(x => x.keypair.privkey),
            inBlinding: inputs.map(x => x.blinding.toString(10)),
            inPathIndices: inputMerklePathIndices,
            inPathElements: inputMerklePathElements,

            // Output UTXO data (UTXOs being created) - ensure all values are in decimal format
            outAmount: outputs.map(x => x.amount.toString(10)),
            outBlinding: outputs.map(x => x.blinding.toString(10)),
            outPubkey: outputs.map(x => x.keypair.pubkey),
        };
        setStatus?.(`(generating ZK proof...)`)
        console.log('Generating proof... (this may take a minute)');

        // Generate the zero-knowledge proof
        const { proof, publicSignals } = await prove(input, CIRCUIT_PATH);
        console.log('done proof')
        // Parse the proof and public signals into byte arrays
        const proofInBytes = parseProofToBytesArray(proof);
        const inputsInBytes = parseToBytesArray(publicSignals);

        // Create the proof object to submit to the program
        const proofToSubmit = {
            proofA: proofInBytes.proofA,
            proofB: proofInBytes.proofB.flat(),
            proofC: proofInBytes.proofC,
            root: inputsInBytes[0],
            publicAmount: inputsInBytes[1],
            extDataHash: inputsInBytes[2],
            inputNullifiers: [
                inputsInBytes[3],
                inputsInBytes[4]
            ],
            outputCommitments: [
                inputsInBytes[5],
                inputsInBytes[6]
            ],
        };

        // Find PDAs for nullifiers and commitments
        const { nullifier0PDA, nullifier1PDA } = findNullifierPDAs(proofToSubmit);
        const { commitment0PDA, commitment1PDA } = findCommitmentPDAs(proofToSubmit);

        console.log('Submitting deposit transaction...');

        // Set compute budget for the transaction (needed for complex transactions)
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_000_000
        });

        // Serialize the proof and extData
        const serializedProof = serializeProofAndExtData(proofToSubmit, extData);
        console.log(`Total serialized proof and extData size: ${serializedProof.length} bytes`);

        // Create the transaction instruction
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: treeAccount, isSigner: false, isWritable: true },
                { pubkey: nullifier0PDA, isSigner: false, isWritable: true },
                { pubkey: nullifier1PDA, isSigner: false, isWritable: true },
                { pubkey: commitment0PDA, isSigner: false, isWritable: true },
                { pubkey: commitment1PDA, isSigner: false, isWritable: true },
                { pubkey: treeTokenAccount, isSigner: false, isWritable: true },
                // recipient
                { pubkey: signed.publicKey, isSigner: false, isWritable: true },
                // fee recipient
                { pubkey: feeRecipientAccount, isSigner: false, isWritable: true },
                // fee recipient
                { pubkey: deployer, isSigner: false, isWritable: false },
                // signer
                { pubkey: signed.publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: serializedProof,
        });

        // Create transaction with compute budget instruction and the main instruction
        const transaction = new Transaction()
            .add(modifyComputeUnits)
            .add(instruction);


        const latestBlockhash = await connection.getLatestBlockhash();
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = signed.publicKey;

        // ask for sign
        const signedTx = await window.solana.signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());

        // confirm the transation
        await connection.confirmTransaction({
            signature: txid,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        });
        console.log('Transaction sent:', txid);
        console.log(`Transaction link: https://explorer.solana.com/tx/${txid}?cluster=devnet`);

        // Wait a moment for the transaction to be confirmed
        setStatus?.(`(waiting for transaction confirmation...)`)
        console.log('Waiting for transaction confirmation...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Check if UTXOs were added to the tree by fetching the tree account again
        try {
            console.log('Fetching updated tree state...');
            const updatedTreeState = await queryRemoteTreeState();

            console.log('Tree state after deposit:');
            console.log('- Current tree nextIndex:', updatedTreeState.nextIndex);
            console.log('- Total UTXOs in tree:', updatedTreeState.nextIndex);
            console.log('- New tree root:', updatedTreeState.root);

            // Calculate the number of new UTXOs added (should be 2)
            const expectedNextIndex = currentNextIndex + 2;
            const utxosAdded = updatedTreeState.nextIndex - currentNextIndex;
            console.log(`UTXOs added in this deposit: ${utxosAdded} (expected: 2)`);

            if (updatedTreeState.nextIndex === expectedNextIndex) {
                console.log('Deposit successful! UTXOs were added to the Merkle tree.');
                return true
            } else {
                console.log(`Warning: Expected nextIndex to be ${expectedNextIndex}, but got ${updatedTreeState.nextIndex}`);
            }
        } catch (error) {
            console.error('Failed to fetch tree state after deposit:', error);
        }
    } catch (error: any) {
        console.error('Error during deposit:', error);
    }
}

