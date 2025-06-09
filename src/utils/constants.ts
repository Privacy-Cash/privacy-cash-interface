'use client'
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export const FIELD_SIZE = new BN('21888242871839275222246405745257275088548364400416034343698204186575808495617')

export const PROGRAM_ID = new PublicKey('8atDWMCWZ6TpWivwKtiSKospNFaGt8envvWs63q9XjVF');

export const FETCH_UTXOS_GROUP_SIZE = 50

export const TRANSACT_IX_DISCRIMINATOR = Buffer.from([217, 149, 130, 143, 221, 52, 252, 119]);
export const CIRCUIT_PATH = '/circuit';
export const MERKLE_TREE_DEPTH = 26;