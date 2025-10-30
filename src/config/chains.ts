// Chain configuration with RPC endpoints and block times
export interface ChainConfig {
  name: string;
  blockTime: number; // in seconds
  defaultRpc?: string;
  commonFactories?: string[];
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: {
    name: "Ethereum",
    blockTime: 12,
    defaultRpc: "https://eth.llamarpc.com",
    commonFactories: [
      "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", // Uniswap V2
      "0x1F98431c8aD98523631AE4a59f267346ea31F984", // Uniswap V3
      "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac", // Sushiswap
    ],
  },
  polygon: {
    name: "Polygon",
    blockTime: 2,
    defaultRpc: "https://polygon-rpc.com",
    commonFactories: [
      "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32", // Quickswap
      "0xc35DADB65012eC5796536bD9864eD8773aBc74C4", // Sushiswap
    ],
  },
  arbitrum: {
    name: "Arbitrum One",
    blockTime: 0.25,
    defaultRpc: "https://arb1.arbitrum.io/rpc",
    commonFactories: [
      "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9", // Camelot
      "0xc35DADB65012eC5796536bD9864eD8773aBc74C4", // Sushiswap
    ],
  },
  optimism: {
    name: "Optimism",
    blockTime: 2,
    defaultRpc: "https://mainnet.optimism.io",
    commonFactories: [
      "0x25CbdDb98b35ab1FF77413456B31EC81A6B6B746", // Velodrome
    ],
  },
  base: {
    name: "Base",
    blockTime: 2,
    defaultRpc: "https://mainnet.base.org",
    commonFactories: [
      "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6", // BaseSwap
      "0x420DD381b31aEf6683db6B902084cB0FFECe40Da", // Aerodrome
    ],
  },
  bsc: {
    name: "BNB Smart Chain",
    blockTime: 3,
    defaultRpc: "https://bsc-dataseed.binance.org",
    commonFactories: [
      "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73", // PancakeSwap V2
      "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865", // PancakeSwap V3
    ],
  },
  avalanche: {
    name: "Avalanche",
    blockTime: 2,
    defaultRpc: "https://api.avax.network/ext/bc/C/rpc",
    commonFactories: [
      "0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10", // TraderJoe
    ],
  },
  fantom: {
    name: "Fantom",
    blockTime: 1,
    defaultRpc: "https://rpc.ftm.tools",
    commonFactories: [
      "0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3", // SpookySwap
    ],
  },
  gnosis: {
    name: "Gnosis Chain",
    blockTime: 5,
    defaultRpc: "https://rpc.gnosischain.com",
    commonFactories: [
      "0xA818b4F111Ccac7AA31D0BCc0806d64F2E0737D7", // HoneySwap
    ],
  },
  celo: {
    name: "Celo",
    blockTime: 5,
    defaultRpc: "https://forno.celo.org",
    commonFactories: [
      "0x62d5b84bE28a183aBB507E125B384122D2C25fAE", // Ubeswap
    ],
  },
  moonbeam: {
    name: "Moonbeam",
    blockTime: 12,
    defaultRpc: "https://rpc.api.moonbeam.network",
    commonFactories: [
      "0x19B85ae92947E0725d5265fFB3389e7E4F191FDa", // StellaSwap
    ],
  },
};

export function getChainConfig(chain: string): ChainConfig | undefined {
  return CHAIN_CONFIGS[chain.toLowerCase()];
}

export function estimateBlocksForTimeWindow(
  chain: string,
  windowMinutes: number
): number {
  const config = getChainConfig(chain);
  if (!config) {
    // Default to Ethereum block time if chain not found
    return Math.floor((windowMinutes * 60) / 12);
  }
  return Math.floor((windowMinutes * 60) / config.blockTime);
}