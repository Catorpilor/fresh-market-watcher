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
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get liquidity data - pass the creation block to get initial liquidity
      const liquidity = await getPairLiquidity(client, pair.pair_address, BigInt(pair.block_number));

      // Get token information with delay
      const tokenInfos: TokenInfo[] = [];
      for (const token of pair.tokens) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const info = await getTokenInfo(client, token);
        tokenInfos.push(info);
      }

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
        // Add token metadata - only addresses as per spec
        tokens: tokenInfos.map(t => t.address),
      });
    } catch (error) {
      console.error(`Error enriching pair ${pair.pair_address}:`, error);
      // Return pair with minimal data even if enrichment fails
      enrichedPairs.push({
        ...pair,
        init_liquidity: 'Unable to fetch',
        top_holders: []
      });
    }
  }

  return enrichedPairs;
}

async function getPairLiquidity(
  client: PublicClient,
  pairAddress: string,
  creationBlock: bigint
): Promise<LiquidityInfo> {
  try {
    console.log(`Fetching initial liquidity for pair: ${pairAddress} at block ${creationBlock}`);

    // Define Mint event ABIs for both V2 and V3
    const V2_MINT_EVENT = parseAbiItem(
      'event Mint(address indexed sender, uint256 amount0, uint256 amount1)'
    );

    const V3_MINT_EVENT = parseAbiItem(
      'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
    );

    // Try to get Mint events (try both V2 and V3)
    const [v2Logs, v3Logs] = await Promise.allSettled([
      client.getLogs({
        address: getAddress(pairAddress),
        event: V2_MINT_EVENT,
        fromBlock: creationBlock,
        toBlock: creationBlock + 10n,
      }),
      client.getLogs({
        address: getAddress(pairAddress),
        event: V3_MINT_EVENT,
        fromBlock: creationBlock,
        toBlock: creationBlock + 10n,
      }),
    ]);

    // Try V2 Mint event first
    if (v2Logs.status === 'fulfilled' && v2Logs.value.length > 0) {
      const firstMint = v2Logs.value[0];
      const decoded = decodeEventLog({
        abi: [V2_MINT_EVENT],
        data: firstMint.data,
        topics: firstMint.topics,
      });

      const args = decoded.args as { sender: string; amount0: bigint; amount1: bigint };

      console.log(`Initial liquidity from V2 Mint event:`, {
        amount0: args.amount0.toString(),
        amount1: args.amount1.toString()
      });

      return {
        reserve0: args.amount0.toString(),
        reserve1: args.amount1.toString(),
        totalSupply: '0',
      };
    }

    // Try V3 Mint event
    if (v3Logs.status === 'fulfilled' && v3Logs.value.length > 0) {
      const firstMint = v3Logs.value[0];
      const decoded = decodeEventLog({
        abi: [V3_MINT_EVENT],
        data: firstMint.data,
        topics: firstMint.topics,
      });

      const args = decoded.args as {
        sender: string;
        owner: string;
        tickLower: number;
        tickUpper: number;
        amount: bigint;
        amount0: bigint;
        amount1: bigint;
      };

      console.log(`Initial liquidity from V3 Mint event:`, {
        amount0: args.amount0.toString(),
        amount1: args.amount1.toString()
      });

      return {
        reserve0: args.amount0.toString(),
        reserve1: args.amount1.toString(),
        totalSupply: '0',
      };
    }

    // Fallback: if no Mint event found, return zero liquidity
    console.log(`No Mint event found for pair ${pairAddress}, likely no initial liquidity yet`);

    return {
      reserve0: '0',
      reserve1: '0',
      totalSupply: '0',
    };
  } catch (error) {
    console.error('Error getting initial liquidity for', pairAddress, ':', error);
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

    console.log('Formatting liquidity:', {
      reserve0: liquidity.reserve0,
      reserve1: liquidity.reserve1,
      token0: tokenInfos[0],
      token1: tokenInfos[1]
    });

    // If reserves are 0, return a clear message
    if (reserve0 === 0n && reserve1 === 0n) {
      return 'No liquidity';
    }

    const decimals0 = tokenInfos[0]?.decimals || 18;
    const decimals1 = tokenInfos[1]?.decimals || 18;

    const formatted0 = formatUnits(reserve0, decimals0);
    const formatted1 = formatUnits(reserve1, decimals1);

    const symbol0 = tokenInfos[0]?.symbol || 'TOKEN0';
    const symbol1 = tokenInfos[1]?.symbol || 'TOKEN1';

    return `${parseFloat(formatted0).toFixed(2)} ${symbol0} / ${parseFloat(formatted1).toFixed(2)} ${symbol1}`;
  } catch (error) {
    console.error('Error formatting liquidity:', error);
    return 'Unknown';
  }
}