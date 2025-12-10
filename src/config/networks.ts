export type NetworkConfig = {
  chainId: number;
  name: string;
  rpcUrl: string;
  contractAddress: string;
  startBlock?: number;
  explorer?: string;
  note?: string;
};

const envStartBlock = import.meta.env.VITE_START_BLOCK ? Number(import.meta.env.VITE_START_BLOCK) : undefined;
const envOptimismRpc = import.meta.env.VITE_OPTIMISM_RPC;
const envContractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;

export const NETWORKS: NetworkConfig[] = [
  {
    chainId: 10,
    name: 'Optimism Mainnet',
    rpcUrl: envOptimismRpc || 'https://mainnet.optimism.io',
    contractAddress: envContractAddress || '0x9d291c7a50A3bF0980E732890177FD4e0998E13a',
    explorer: 'https://optimistic.etherscan.io',
    startBlock: envStartBlock ?? undefined
  }
];

export const DEFAULT_CHAIN_ID = 10;

export function getNetworkConfig(chainId?: number): NetworkConfig {
  return NETWORKS.find((network) => network.chainId === chainId) ?? NETWORKS.find((n) => n.chainId === DEFAULT_CHAIN_ID)!;
}
