import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers';
import { getNetworkConfig } from '../config/networks';
import { COLLECTION_ABI } from './abi';
export function getRpcProvider(chainId) {
    const network = getNetworkConfig(chainId);
    return new JsonRpcProvider(network.rpcUrl);
}
export function getBrowserProvider() {
    if (typeof window === 'undefined')
        return undefined;
    if (typeof window.ethereum === 'undefined')
        return undefined;
    return new BrowserProvider(window.ethereum);
}
export function getContract(chainId, providerOrSigner) {
    const network = getNetworkConfig(chainId);
    const baseProvider = providerOrSigner ?? getRpcProvider(network.chainId);
    return new Contract(network.contractAddress, COLLECTION_ABI, baseProvider);
}
export function buildImageSrc(svg) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
export function extractImageFromUri(uri) {
    if (!uri)
        return undefined;
    // data:application/json;base64,<payload>
    const prefix = 'data:application/json;base64,';
    if (uri.startsWith(prefix)) {
        try {
            const decoded = atob(uri.slice(prefix.length));
            const parsed = JSON.parse(decoded);
            if (typeof parsed.image === 'string') {
                return parsed.image;
            }
        }
        catch (err) {
            console.error('Failed to parse token URI json', err);
        }
    }
    return undefined;
}
const SCAN_DELAY_MS = import.meta.env.VITE_SCAN_DELAY_MS ? Number(import.meta.env.VITE_SCAN_DELAY_MS) : 0;
const MAX_SEQUENTIAL_SCAN = import.meta.env.VITE_MAX_COLLECTION_SCAN
    ? Number(import.meta.env.VITE_MAX_COLLECTION_SCAN)
    : 200;
export async function listCollectionIds(contract) {
    // Sequential scan via getCollectionInfo; assumes contiguous IDs starting from 1
    const sequential = [];
    const upperBound = MAX_SEQUENTIAL_SCAN > 0 ? MAX_SEQUENTIAL_SCAN : 0;
    if (upperBound === 0)
        return sequential;
    for (let tokenId = 1; tokenId <= upperBound; tokenId++) {
        try {
            await contract.getCollectionInfo(tokenId);
            sequential.push(tokenId);
            if (SCAN_DELAY_MS > 0) {
                await new Promise((resolve) => setTimeout(resolve, SCAN_DELAY_MS));
            }
        }
        catch {
            break;
        }
    }
    return sequential;
}
export async function loadCollections(contract, ids, account) {
    const collections = [];
    for (const tokenId of ids) {
        try {
            const info = await contract.getCollectionInfo(tokenId);
            const [name, description] = [info.name, info.description];
            const maxSupply = Number(info.maxSupply ?? info[2] ?? 0n);
            const currentSupply = Number(info.currentSupply ?? info[3] ?? 0n);
            const isWhitelistEnabled = Boolean(info.isWhitelistEnabled ?? info[4]);
            const isActive = Boolean(info.isActive ?? info[5]);
            const svgChunkCount = Number(info.svgChunkCount ?? info[6] ?? 0n);
            const isSvgFinalized = Boolean(info.isSvgFinalized ?? info[7]);
            const [hasClaimed, isWhitelisted] = account
                ? await Promise.all([
                    contract.hasClaimed(tokenId, account),
                    isWhitelistEnabled ? contract.isWhitelisted(tokenId, account) : Promise.resolve(false)
                ])
                : [false, false];
            let svg;
            let imageSrc;
            if (svgChunkCount > 0) {
                try {
                    svg = await contract.getSvgData(tokenId);
                    imageSrc = svg ? buildImageSrc(svg) : undefined;
                }
                catch (err) {
                    console.warn(`getSvgData failed for token ${tokenId}, fallback to uri`, err);
                }
            }
            if (!imageSrc) {
                try {
                    const uri = await contract.uri(tokenId);
                    const embedded = extractImageFromUri(uri);
                    if (embedded) {
                        imageSrc = embedded;
                        if (embedded.startsWith('data:image/svg+xml;base64,')) {
                            const base64 = embedded.replace('data:image/svg+xml;base64,', '');
                            try {
                                svg = atob(base64);
                            }
                            catch {
                                // ignore decode errors
                            }
                        }
                    }
                }
                catch (err) {
                    console.warn(`uri() fallback failed for token ${tokenId}`, err);
                }
            }
            collections.push({
                tokenId,
                name,
                description,
                maxSupply,
                currentSupply,
                isWhitelistEnabled,
                isActive,
                svgChunkCount,
                isSvgFinalized,
                svg,
                imageSrc,
                hasClaimed: Boolean(hasClaimed),
                isWhitelisted: Boolean(isWhitelisted)
            });
        }
        catch (error) {
            console.error(`Failed to load collection ${tokenId}`, error);
        }
    }
    return collections;
}
