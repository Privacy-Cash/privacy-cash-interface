'use client'
// import { WasmFactory } from '@lightprotocol/hasher.rs';
import { Keypair as UtxoKeypair } from '../models/keypair';
import { Utxo } from '../models/utxo';


// Import noble hashes and ciphers
import { ctr } from '@noble/ciphers/aes'; // Import ctr mode from @noble/ciphers/aes
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { TRANSACT_IX_DISCRIMINATOR } from './constants';
import { Buffer } from 'buffer';
/**
 * Represents a UTXO with minimal required fields
 */
export interface UtxoData {
  amount: string;
  blinding: string;
  index: number | string;
  // Optional additional fields
  [key: string]: any;
}

// Custom timingSafeEqual for browser compatibility
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Service for handling encryption and decryption of UTXO data
 */
export class EncryptionService {
  private encryptionKey: Uint8Array | null = null;

  /**
   * Initialize the encryption service with an encryption key
   * @param encryptionKey The encryption key to use for encryption and decryption
   */
  constructor(encryptionKey?: Uint8Array) {
    if (encryptionKey) {
      this.encryptionKey = encryptionKey;
    }
  }

  /**
   * Set the encryption key directly
   * @param encryptionKey The encryption key to set
   */
  public setEncryptionKey(encryptionKey: Uint8Array): void {
    this.encryptionKey = encryptionKey;
  }

  /**
   * Generate an encryption key from a signature
   * @param signature The user's signature
   * @returns The generated encryption key
   */
  public deriveEncryptionKeyFromSignature(signature: Uint8Array): Uint8Array {
    // Extract the first 31 bytes of the signature to create a deterministic key
    const encryptionKey = signature.slice(0, 31);

    // Store the key in the service
    this.encryptionKey = encryptionKey;

    return encryptionKey;
  }

  /**
   * Encrypt data with the stored encryption key
   * @param data The data to encrypt
   * @returns The encrypted data as a Uint8Array
   * @throws Error if the encryption key has not been generated
   */
  public encrypt(data: Uint8Array | string): Uint8Array {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set. Call setEncryptionKey or deriveEncryptionKeyFromWallet first.');
    }

    // Convert string to Uint8Array if needed
    const dataUint8Array = typeof data === 'string' ? new TextEncoder().encode(data) : data;

    // Generate a standard initialization vector (16 bytes)
    const iv = randomBytes(16);

    // Create a key from our encryption key (using only first 16 bytes for AES-128)
    const key = this.encryptionKey.slice(0, 16);

    // Use AES-128-CTR from @noble/ciphers/aes
    const encryptedData = ctr(key, iv).encrypt(dataUint8Array);

    // Create an authentication tag (HMAC) to verify decryption with correct key
    const hmacKey = this.encryptionKey.slice(16, 31);
    const hmacHasher = hmac.create(sha256, hmacKey);
    hmacHasher.update(iv);
    hmacHasher.update(encryptedData);
    const authTag = hmacHasher.digest().slice(0, 16); // Use first 16 bytes of HMAC as auth tag

    // Combine IV, auth tag and encrypted data
    const combined = new Uint8Array(iv.length + authTag.length + encryptedData.length);
    combined.set(iv, 0);
    combined.set(authTag, iv.length);
    combined.set(encryptedData, iv.length + authTag.length);

    return combined;
  }

  /**
   * Decrypt data with the stored encryption key
   * @param encryptedData The encrypted data to decrypt
   * @returns The decrypted data as a Uint8Array
   * @throws Error if the encryption key has not been generated or if the wrong key is used
   */
  public decrypt(encryptedData: Uint8Array): Uint8Array {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set. Call setEncryptionKey or deriveEncryptionKeyFromWallet first.');
    }

    // Extract the IV from the first 16 bytes
    const iv = encryptedData.slice(0, 16);
    // Extract the auth tag from the next 16 bytes
    const authTag = encryptedData.slice(16, 32);
    // The rest is the actual encrypted data
    const data = encryptedData.slice(32);

    // Verify the authentication tag
    const hmacKey = this.encryptionKey.slice(16, 31);
    const hmacHasher = hmac.create(sha256, hmacKey);
    hmacHasher.update(iv);
    hmacHasher.update(data);
    const calculatedTag = hmacHasher.digest().slice(0, 16);

    // Compare tags - if they don't match, the key is wrong
    if (!timingSafeEqual(authTag, calculatedTag)) {
      throw new Error('Failed to decrypt data. Invalid encryption key or corrupted data.');
    }

    // Create a key from our encryption key (using only first 16 bytes for AES-128)
    const key = this.encryptionKey.slice(0, 16);

    try {
      // Use the same algorithm as in encrypt from @noble/ciphers/aes
      return ctr(key, iv).decrypt(data);
    } catch (error) {
      throw new Error('Failed to decrypt data. Invalid encryption key or corrupted data.');
    }
  }

  /**
   * Check if the encryption key has been set
   * @returns True if the encryption key exists, false otherwise
   */
  public hasEncryptionKey(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Get the encryption key (for testing purposes)
   * @returns The current encryption key or null
   */
  public getEncryptionKey(): Uint8Array | null {
    return this.encryptionKey;
  }

  /**
   * Reset the encryption key (mainly for testing purposes)
   */
  public resetEncryptionKey(): void {
    this.encryptionKey = null;
  }

  /**
   * Encrypt a UTXO using a compact pipe-delimited format
   * @param utxo The UTXO to encrypt
   * @returns The encrypted UTXO data as a Uint8Array
   * @throws Error if the encryption key has not been set
   */
  public encryptUtxo(utxo: Utxo): Uint8Array {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set. Call setEncryptionKey or deriveEncryptionKeyFromWallet first.');
    }

    // Create a compact string representation using pipe delimiter
    const utxoString = `${utxo.amount.toString()}|${utxo.blinding.toString()}|${utxo.index}`;

    // Use the regular encrypt method
    return this.encrypt(utxoString);
  }

  /**
   * Decrypt an encrypted UTXO and parse it to a Utxo instance
   * @param encryptedData The encrypted UTXO data
   * @param keypair The UTXO keypair to use for the decrypted UTXO
   * @param lightWasm Optional LightWasm instance. If not provided, a new one will be created
   * @returns Promise resolving to the decrypted Utxo instance
   * @throws Error if the encryption key has not been set or if decryption fails
   */
  public async decryptUtxo(encryptedData: Uint8Array | string, keypair: UtxoKeypair, lightWasm?: any): Promise<Utxo> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set. Call setEncryptionKey or deriveEncryptionKeyFromWallet first.');
    }

    // Convert hex string to Uint8Array if needed
    const encryptedUint8Array = typeof encryptedData === 'string'
      ? Uint8Array.from(Buffer.from(encryptedData, 'hex')) // Assuming Buffer is available or polyfilled for hex conversion
      : encryptedData;

    // Decrypt the data using the regular decrypt method
    const decrypted = this.decrypt(encryptedUint8Array);

    // Parse the pipe-delimited format
    const decryptedStr = new TextDecoder().decode(decrypted);
    const [amount, blinding, index] = decryptedStr.split('|');

    if (!amount || !blinding || index === undefined) {
      throw new Error('Invalid UTXO format after decryption');
    }
    // Get or create a LightWasm instance
    const wasmInstance = lightWasm || await getHasher()

    // Create a Utxo instance with the provided keypair
    return new Utxo({
      lightWasm: wasmInstance,
      amount: amount,
      blinding: blinding,
      keypair: keypair,
      index: Number(index)
    });
  }

  /**
   * Derive a deterministic UTXO private key from the wallet's encryption key
   * @returns A private key in hex format that can be used to create a UTXO keypair
   * @throws Error if the encryption key has not been set
   */
  public deriveUtxoPrivateKey(): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set. Call setEncryptionKey or deriveEncryptionKeyFromWallet first.');
    }

    // Use a hash function to generate a deterministic private key from the encryption key
    const hashedSeed = sha256(this.encryptionKey);

    // Convert to a hex string compatible with ethers.js private key format
    return '0x' + Array.from(hashedSeed).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}



// Function to serialize proof and extData (same as original withdraw script)
export function serializeProofAndExtData(proof: any, extData: any) {
  const proofBuf = Buffer.alloc(1000); // Allocate enough space
  let offset = 0;

  // Write proofA (64 bytes)
  proof.proofA.forEach((b: number) => {
    proofBuf.writeUInt8(b, offset);
    offset += 1;
  });

  // Write proofB (128 bytes)
  proof.proofB.forEach((b: number) => {
    proofBuf.writeUInt8(b, offset);
    offset += 1;
  });

  // Write proofC (64 bytes)
  proof.proofC.forEach((b: number) => {
    proofBuf.writeUInt8(b, offset);
    offset += 1;
  });

  // Write root (32 bytes)
  proof.root.forEach((b: number) => {
    proofBuf.writeUInt8(b, offset);
    offset += 1;
  });

  // Write publicAmount (32 bytes)
  proof.publicAmount.forEach((b: number) => {
    proofBuf.writeUInt8(b, offset);
    offset += 1;
  });

  // Write extDataHash (32 bytes)
  proof.extDataHash.forEach((b: number) => {
    proofBuf.writeUInt8(b, offset);
    offset += 1;
  });

  // Write input nullifiers (2 x 32 bytes)
  proof.inputNullifiers.forEach((nullifier: number[]) => {
    nullifier.forEach((b: number) => {
      proofBuf.writeUInt8(b, offset);
      offset += 1;
    });
  });

  // Write output commitments (2 x 32 bytes)
  proof.outputCommitments.forEach((commitment: number[]) => {
    commitment.forEach((b: number) => {
      proofBuf.writeUInt8(b, offset);
      offset += 1;
    });
  });

  // ExtData serialization
  const extDataBuf = Buffer.alloc(500); // Allocate enough space
  let extOffset = 0;

  // Recipient pubkey (32 bytes)
  extData.recipient.toBuffer().copy(extDataBuf, extOffset);
  extOffset += 32;

  // extAmount (8 bytes) - i64
  extDataBuf.writeBigInt64LE(BigInt(extData.extAmount.toString()), extOffset);
  extOffset += 8;

  // encrypted_output1 length and data
  const encOut1Len = extData.encryptedOutput1.length;
  extDataBuf.writeUInt32LE(encOut1Len, extOffset);
  extOffset += 4;
  console.log('extData.encryptedOutput1.copy', typeof extData.encryptedOutput1, typeof extData.encryptedOutput1.copy)
  // Use Uint8Array.set() for browser compatibility instead of Buffer.copy()
  const encOut1Array = new Uint8Array(extData.encryptedOutput1);
  new Uint8Array(extDataBuf.buffer, extDataBuf.byteOffset + extOffset, encOut1Len).set(encOut1Array);
  extOffset += encOut1Len;

  // encrypted_output2 length and data
  const encOut2Len = extData.encryptedOutput2.length;
  extDataBuf.writeUInt32LE(encOut2Len, extOffset);
  extOffset += 4;
  // Use Uint8Array.set() for browser compatibility instead of Buffer.copy()
  const encOut2Array = new Uint8Array(extData.encryptedOutput2);
  new Uint8Array(extDataBuf.buffer, extDataBuf.byteOffset + extOffset, encOut2Len).set(encOut2Array);
  extOffset += encOut2Len;

  // fee (8 bytes) - u64
  extDataBuf.writeBigUInt64LE(BigInt(extData.fee.toString()), extOffset);
  extOffset += 8;

  // Combine instruction discriminator with proof and extData
  const instructionData = Buffer.concat([
    TRANSACT_IX_DISCRIMINATOR,
    proofBuf.slice(0, offset),
    extDataBuf.slice(0, extOffset)
  ]);

  return instructionData;
}

// convert Uint8Array<ArrayBufferLike> to base64
export function uint8ArrayToBase64(u8arr: Uint8Array<ArrayBufferLike>) {
  const binaryString = String.fromCharCode(...u8arr);
  return btoa(binaryString);
}

export async function getHasher() {
  // const lightWasm = await WasmFactory.getInstance();
  // return await WasmFactory.loadHasher({ wasm: 'light_wasm_hasher_bg.wasm' })
  return {} as any
}