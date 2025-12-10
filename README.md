# Nitchu Gakuin Digital Collections (NFT Platform)

[🇺🇸 **English**](README.md)　[🇯🇵 日本語](README.ja.md)　[🇨🇳 中文](README.zh.md)

---

Version: v1.0.0  
Contract Address: `0x9d291c7a50A3bF0980E732890177FD4e0998E13a`  
Blockchain: Optimism Mainnet (OP)  
Standard: ERC-1155 + UUPS (Upgradeable)

---

## Overview

This website allows users to view and claim digital collections (NFTs) issued by Nitchu Gakuin.  
Administrators can configure contract settings and manage NFTs through the management panel.  
The site connects via MetaMask (browser extension).

---

## Prerequisites

1. Install the MetaMask browser extension (Chrome recommended).
2. Create or import a wallet.
3. Verify that the displayed contract address is correct.
4. Switch your MetaMask network to **Optimism Mainnet**.

---

## General Users (Viewing & Claiming NFTs)

### 1. Connect Wallet

Use the “Connect MetaMask” button at the top to connect your wallet.

### 2. **Collections List**

Displays all issued collections.  
If an image is visible, it means the SVG has been successfully uploaded.

### 3. **Claim Page**

Shows collections that are:

- Active
- SVG data finalized

#### If the claim button is disabled, common reasons include:

- Wallet not connected / wrong network
- Supply cap reached
- Not included in whitelist
- Already claimed

When all conditions are met, click **Claim**, confirm in MetaMask, and receive **1 NFT**.

---

## Administrators

(Owner or addresses with admin privileges)

### 1. Accessing Admin Panel

When connected with an owner/admin wallet, a **Management** tab will appear.

### 2. Management Functions

#### **Contract Info**

Displays contract address, owner, and contract version.

#### **Create New Collection**

Set parameters:

- Name
- Description
- Maximum supply (0 = unlimited)
- Whitelist enabled/disabled
- Activate immediately after creation

#### **SVG Upload**

Upload chunked on-chain SVG data:

1. Enter **Token ID**, **chunkIndex** (starting at 0), and paste SVG text (≤ ~30 KB recommended).
2. Click **Step 1: Add Chunk**.
3. After all chunks are uploaded, click **Step 2: Complete Upload** (content becomes immutable).

#### **Status Update**

Toggle for each Token ID:

- Whitelist enabled
- Active / inactive  
  The current status is shown at the top.

#### **Whitelist Management**

Add or remove addresses (comma-separated).  
You can also check whether an address is whitelisted.

#### **Airdrop**

Enter Token ID and a list of addresses to distribute **1 NFT per address**.

#### **Admin Management**

Add or remove administrator addresses.  
You can verify whether a specific address has admin rights.

#### **Contract Control (Owner Only)**

- Pause
- Unpause

### 3. Refresh State

Click “Refresh Status” to load the latest on-chain information.

---

## License

This project is intended for educational and institutional use within Nitchu Gakuin.

## Setup

```bash
cd frontend
npm install
npm run dev
```
