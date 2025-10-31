import {
  createPublicClient,
  http,
  parseAbiItem,
  decodeEventLog,
  getAddress,
  type Log,
  type PublicClient,
} from 'viem';
import { getChainConfig, estimateBlocksForTimeWindow } from '../config/chains';
import { cache, Cache } from './cache';
import { enrichPairData } from './enrichment';

// Event ABIs for V2 and V3
const PAIR_CREATED_EVENT = parseAbiItem(
  'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)'
);

const POOL_CREATED_EVENT = parseAbiItem(
  'event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)'
);

export interface PairInfo {
  pair_address: string;
  tokens: string[];
  init_liquidity?: string;
  top_holders?: string[];
  created_at: string;
  block_number: number;
  transaction_hash: string;
  factory: string;
  // V3-specific fields (optional)
  fee?: string;           // Fee tier (500, 3000, 10000)
  tick_spacing?: number;  // Tick spacing
  pool_type?: 'v2' | 'v3'; // Pool version
}

export interface DetectOptions {
  chain: string;
  factories: string[];
  windowMinutes: number;
  rpcUrl?: string;
}

export async function detectNewPairs(options: DetectOptions): Promise<PairInfo[]> {
  const { chain, factories, windowMinutes, rpcUrl } = options;

  // Get chain configuration
  const chainConfig = getChainConfig(chain);
  const rpcEndpoint = rpcUrl || chainConfig?.defaultRpc;

  if (!rpcEndpoint) {
    throw new Error(`No RPC endpoint available for chain: ${chain}. Please provide rpc_url parameter.`);
  }

  // Create viem client
  const client = createPublicClient({
    transport: http(rpcEndpoint),
  }) as PublicClient;

  try {
    // Get current block number
    const currentBlock = await client.getBlockNumber();

    // Calculate block range
    const blocksToScan = estimateBlocksForTimeWindow(chain, windowMinutes);
    const fromBlock = currentBlock - BigInt(blocksToScan);

    // Check cache first
    const cacheKey = Cache.generateKey(
      chain,
      factories,
      Number(fromBlock),
      Number(currentBlock)
    );

    const cachedResult = cache.get<PairInfo[]>(cacheKey);
    if (cachedResult) {
      console.log('Returning cached result');
      return cachedResult;
    }

    // Query logs for PairCreated and PoolCreated events from all factories
    const allPairs: PairInfo[] = [];

    for (const factory of factories) {
      try {
        const factoryAddress = getAddress(factory);

        // Try to get both V2 and V3 events
        const [v2Logs, v3Logs] = await Promise.allSettled([
          client.getLogs({
            address: factoryAddress,
            event: PAIR_CREATED_EVENT,
            fromBlock,
            toBlock: currentBlock,
          }),
          client.getLogs({
            address: factoryAddress,
            event: POOL_CREATED_EVENT,
            fromBlock,
            toBlock: currentBlock,
          }),
        ]);

        // Parse V2 logs (if successful)
        if (v2Logs.status === 'fulfilled') {
          for (const log of v2Logs.value) {
            try {
              const pairInfo = await parsePairCreatedLog(client, log, factoryAddress);
              allPairs.push(pairInfo);
            } catch (error) {
              console.error(`Error parsing V2 log: ${error}`);
            }
          }
        }

        // Parse V3 logs (if successful)
        if (v3Logs.status === 'fulfilled') {
          for (const log of v3Logs.value) {
            try {
              const poolInfo = await parsePoolCreatedLog(client, log, factoryAddress);
              allPairs.push(poolInfo);
            } catch (error) {
              console.error(`Error parsing V3 log: ${error}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error querying factory ${factory}: ${error}`);
        // Continue with next factory
      }
    }

    // Deduplicate pairs (in case of duplicates)
    const uniquePairs = deduplicatePairs(allPairs);

    // Enrich pairs with additional data
    const enrichedPairs = await enrichPairData(client, uniquePairs);

    // Cache the result
    cache.set(cacheKey, enrichedPairs, 60 * 1000); // Cache for 60 seconds

    return enrichedPairs;
  } catch (error) {
    console.error('Error detecting new pairs:', error);
    throw new Error(`Failed to detect new pairs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parsePairCreatedLog(
  client: PublicClient,
  log: Log,
  factory: string
): Promise<PairInfo> {
  // Decode the event
  const decodedLog = decodeEventLog({
    abi: [PAIR_CREATED_EVENT],
    data: log.data,
    topics: log.topics,
  });

  // Extract args based on the PairCreated event signature
  const [token0, token1, pair] = decodedLog.args as readonly [`0x${string}`, `0x${string}`, `0x${string}`, bigint];

  // Get block timestamp
  const block = await client.getBlock({ blockNumber: log.blockNumber! });

  return {
    pair_address: getAddress(pair),
    tokens: [getAddress(token0), getAddress(token1)],
    created_at: new Date(Number(block.timestamp) * 1000).toISOString(),
    block_number: Number(log.blockNumber),
    transaction_hash: log.transactionHash!,
    factory: factory,
    pool_type: 'v2',
  };
}

async function parsePoolCreatedLog(
  client: PublicClient,
  log: Log,
  factory: string
): Promise<PairInfo> {
  // Decode the V3 PoolCreated event
  const decodedLog = decodeEventLog({
    abi: [POOL_CREATED_EVENT],
    data: log.data,
    topics: log.topics,
  });

  // Extract args based on the PoolCreated event signature
  const { token0, token1, fee, tickSpacing, pool } = decodedLog.args as {
    token0: `0x${string}`;
    token1: `0x${string}`;
    fee: number;
    tickSpacing: number;
    pool: `0x${string}`;
  };

  // Get block timestamp
  const block = await client.getBlock({ blockNumber: log.blockNumber! });

  return {
    pair_address: getAddress(pool),
    tokens: [getAddress(token0), getAddress(token1)],
    created_at: new Date(Number(block.timestamp) * 1000).toISOString(),
    block_number: Number(log.blockNumber),
    transaction_hash: log.transactionHash!,
    factory: factory,
    fee: fee.toString(),
    tick_spacing: tickSpacing,
    pool_type: 'v3',
  };
}

function deduplicatePairs(pairs: PairInfo[]): PairInfo[] {
  const seen = new Set<string>();
  const unique: PairInfo[] = [];

  for (const pair of pairs) {
    if (!seen.has(pair.pair_address)) {
      seen.add(pair.pair_address);
      unique.push(pair);
    }
  }

  return unique;
}