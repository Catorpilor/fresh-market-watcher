import {
  type PublicClient,
  getAddress,
  formatUnits,
  parseAbiItem,
  decodeEventLog,
} from 'viem';
import type { PairInfo } from './detector';

// Common ABIs for AMM pairs and ERC20 tokens
const PAIR_ABI = [
  parseAbiItem('function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'),
  parseAbiItem('function totalSupply() view returns (uint256)'),
  parseAbiItem('function token0() view returns (address)'),
  parseAbiItem('function token1() view returns (address)'),
  parseAbiItem('function balanceOf(address account) view returns (uint256)'),
];

const ERC20_ABI = [
  parseAbiItem('function name() view returns (string)'),
  parseAbiItem('function symbol() view returns (string)'),
  parseAbiItem('function decimals() view returns (uint8)'),
  parseAbiItem('function totalSupply() view returns (uint256)'),
  parseAbiItem('function balanceOf(address account) view returns (uint256)'),
];

// Transfer event for finding holders
const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

interface TokenInfo {
  address: string;
  name?: string;
  symbol?: string;
  decimals?: number;
}

interface LiquidityInfo {
  reserve0: string;
  reserve1: string;
  totalSupply: string;
}

export async function enrichPairData(
  client: PublicClient,
  pairs: PairInfo[]
): Promise<PairInfo[]> {
  const enrichedPairs: PairInfo[] = [];

  for (const pair of pairs) {
    try {
      // Get liquidity data
      const liquidity = await getPairLiquidity(client, pair.pair_address);

      // Get token information
      const tokenInfos = await Promise.all(
        pair.tokens.map(token => getTokenInfo(client, token))
      );

      // Get top holders (limited to top 5)
      const topHolders = await getTopHolders(
        client,
        pair.pair_address,
        BigInt(pair.block_number),
        5
      );

      // Calculate initial liquidity value (in token units)
      const initLiquidity = formatInitialLiquidity(
        liquidity,
        tokenInfos
      );

      enrichedPairs.push({
        ...pair,
        init_liquidity: initLiquidity,
        top_holders: topHolders,
        // Add token metadata
        tokens: tokenInfos.map(t => `${t.address} (${t.symbol || 'Unknown'})`),
      });
    } catch (error) {
      console.error(`Error enriching pair ${pair.pair_address}:`, error);
      // Return pair with available data even if enrichment fails
      enrichedPairs.push(pair);
    }
  }

  return enrichedPairs;
}

async function getPairLiquidity(
  client: PublicClient,
  pairAddress: string
): Promise<LiquidityInfo> {
  try {
    const [reserves, totalSupply] = await Promise.all([
      client.readContract({
        address: getAddress(pairAddress),
        abi: PAIR_ABI,
        functionName: 'getReserves',
      }),
      client.readContract({
        address: getAddress(pairAddress),
        abi: PAIR_ABI,
        functionName: 'totalSupply',
      }),
    ]);

    const [reserve0, reserve1] = reserves as [bigint, bigint, number];

    return {
      reserve0: reserve0.toString(),
      reserve1: reserve1.toString(),
      totalSupply: totalSupply.toString(),
    };
  } catch (error) {
    console.error('Error getting liquidity:', error);
    return {
      reserve0: '0',
      reserve1: '0',
      totalSupply: '0',
    };
  }
}

async function getTokenInfo(
  client: PublicClient,
  tokenAddress: string
): Promise<TokenInfo> {
  const info: TokenInfo = {
    address: getAddress(tokenAddress),
  };

  try {
    // Try to get token metadata (may fail for some tokens)
    const [name, symbol, decimals] = await Promise.allSettled([
      client.readContract({
        address: getAddress(tokenAddress),
        abi: ERC20_ABI,
        functionName: 'name',
      }),
      client.readContract({
        address: getAddress(tokenAddress),
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      client.readContract({
        address: getAddress(tokenAddress),
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);

    if (name.status === 'fulfilled') {
      info.name = name.value as string;
    }
    if (symbol.status === 'fulfilled') {
      info.symbol = symbol.value as string;
    }
    if (decimals.status === 'fulfilled') {
      info.decimals = decimals.value as number;
    }
  } catch (error) {
    console.error(`Error getting token info for ${tokenAddress}:`, error);
  }

  return info;
}

async function getTopHolders(
  client: PublicClient,
  pairAddress: string,
  fromBlock: bigint,
  limit: number = 5
): Promise<string[]> {
  try {
    // Get Transfer events to find holders
    // Note: This is a simplified approach. For production, you might want to:
    // 1. Use an indexer service like The Graph
    // 2. Query more blocks and build a complete holder list
    // 3. Cache holder data

    const currentBlock = await client.getBlockNumber();
    const maxBlocks = 1000n; // Limit to recent blocks to avoid timeouts
    const scanFromBlock = currentBlock - maxBlocks > fromBlock
      ? currentBlock - maxBlocks
      : fromBlock;

    const logs = await client.getLogs({
      address: getAddress(pairAddress),
      event: TRANSFER_EVENT,
      fromBlock: scanFromBlock,
      toBlock: currentBlock,
    });

    // Build holder balances from transfer events
    const balances = new Map<string, bigint>();

    for (const log of logs) {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT],
        data: log.data,
        topics: log.topics,
      });

      const { from, to, value } = decoded.args as {
        from: `0x${string}`;
        to: `0x${string}`;
        value: bigint;
      };

      // Update balances
      if (from !== '0x0000000000000000000000000000000000000000') {
        const fromBalance = balances.get(from) || 0n;
        balances.set(from, fromBalance - value);
      }

      if (to !== '0x0000000000000000000000000000000000000000') {
        const toBalance = balances.get(to) || 0n;
        balances.set(to, toBalance + value);
      }
    }

    // Sort by balance and get top holders
    const sortedHolders = Array.from(balances.entries())
      .filter(([_, balance]) => balance > 0n)
      .sort((a, b) => {
        const diff = b[1] - a[1];
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
      })
      .slice(0, limit)
      .map(([address, _]) => getAddress(address));

    return sortedHolders;
  } catch (error) {
    console.error('Error getting top holders:', error);
    return [];
  }
}

function formatInitialLiquidity(
  liquidity: LiquidityInfo,
  tokenInfos: TokenInfo[]
): string {
  try {
    const reserve0 = BigInt(liquidity.reserve0);
    const reserve1 = BigInt(liquidity.reserve1);

    const decimals0 = tokenInfos[0]?.decimals || 18;
    const decimals1 = tokenInfos[1]?.decimals || 18;

    const formatted0 = formatUnits(reserve0, decimals0);
    const formatted1 = formatUnits(reserve1, decimals1);

    const symbol0 = tokenInfos[0]?.symbol || 'TOKEN0';
    const symbol1 = tokenInfos[1]?.symbol || 'TOKEN1';

    return `${parseFloat(formatted0).toFixed(2)} ${symbol0} / ${parseFloat(formatted1).toFixed(2)} ${symbol1}`;
  } catch (error) {
    return 'Unknown';
  }
}