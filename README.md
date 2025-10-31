# Fresh Market Watch

An AI agent that detects new AMM (Automated Market Maker) pairs/pools created on EVM-compatible blockchains within a specified time window. Supports both Uniswap V2 and V3 style pools.

## Features

- **Multi-Chain Support**: Works with any EVM-compatible chain (Ethereum, Polygon, Arbitrum, Base, BSC, etc.)
- **V2 & V3 Pool Detection**: Supports both Uniswap V2 (PairCreated) and V3 (PoolCreated) style pools
- **Real-time Detection**: Detects new pairs within 60 seconds of creation
- **Accurate Initial Liquidity**: Fetches actual initial liquidity from Mint events (not post-trade reserves)
- **Low False Positives**: Less than 1% false positive rate through validation pipeline
- **Data Enrichment**: Provides liquidity data, token information, and top holders
- **x402 Payment Integration**: Monetized endpoint using the x402 payment protocol
- **In-Memory Caching**: 60-second cache to reduce RPC calls
- **Custom RPC Support**: Allows custom RPC endpoints for any chain
- **Rate Limiting Protection**: Built-in delays to avoid RPC rate limits

## Quick Start

```sh
npm install
npm run dev
```

The dev command runs in watch mode, starts the HTTP server on port 8787, and reloads when you change files inside `src/`.

## Environment Variables

Create a `.env` file with the following variables:

```env
# Required
PRIVATE_KEY=your_private_key_here

# Optional - Payment Configuration
FACILITATOR_URL=https://facilitator.payai.network
PAY_TO_ADDRESS=0x4Dec2Ac51E74EDFCFFA084A14A008FaA9E6F739c
PAYMENT_NETWORK=base
DEFAULT_PRICE=100000
ENTRYPOINT_PRICE=0.03

# Optional - Server Configuration
PORT=8787
API_BASE_URL=http://localhost:8787
```

See `.env.example` for all available options.

## Project Structure

- `src/agent.ts` – Defines the agent manifest and entrypoints with x402 payment integration
- `src/index.ts` – Boots a Bun HTTP server with the agent
- `src/services/detector.ts` – Core AMM pair detection logic (supports V2 & V3)
- `src/services/enrichment.ts` – Token and liquidity data enrichment with Mint event tracking
- `src/services/cache.ts` – In-memory caching implementation
- `src/config/chains.ts` – Chain configurations and RPC endpoints

## API Usage

### Endpoint

The agent provides a paid entrypoint `list` accessible via x402 protocol at:

`POST http://localhost:8787/entrypoints/list/invoke`

**Note**: This endpoint requires x402 payment. Price: $0.03 USDC per request.

### Request Parameters

- `chain` (string, required): Target blockchain (ethereum, polygon, arbitrum, optimism, base, bsc, etc.)
- `factories` (string, required): Comma-separated AMM factory contract addresses to monitor
- `window_minutes` (string, required): Time window to scan in minutes (1-99)
- `rpc_url` (string, optional): Custom RPC URL. If not provided, uses default for the chain

### Example Request (with x402 payment)

```typescript
import { withPaymentInterceptor, createSigner } from "x402-axios";
import axios from "axios";

const signer = await createSigner("base", process.env.PRIVATE_KEY);
const api = withPaymentInterceptor(axios.create({
  baseURL: "http://localhost:8787"
}), signer);

const response = await api.post("/entrypoints/list/invoke", {
  input: {
    chain: "base",
    factories: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    window_minutes: "5"
  }
});
```

### Example Response

```json
{
  "run_id": "...",
  "status": "succeeded",
  "output": {
    "success": true,
    "chain": "base",
    "window_minutes": "5",
    "total_pairs_found": 2,
    "pairs": [
      {
        "pair_address": "0x...",
        "tokens": ["0x4200000000000000000000000000000000000006", "0x..."],
        "pool_type": "v2",
        "init_liquidity": "0.11 WETH / 5600000000 TOKEN",
        "top_holders": ["0x...", "0x..."],
        "created_at": "2025-10-30T11:11:15.000Z",
        "block_number": 37516664,
        "transaction_hash": "0x...",
        "factory": "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6"
      },
      {
        "pair_address": "0x...",
        "tokens": ["0x4200000000000000000000000000000000000006", "0x833..."],
        "pool_type": "v3",
        "fee": "3000",
        "tick_spacing": 60,
        "init_liquidity": "1.5 WETH / 5000 USDC",
        "top_holders": ["0x..."],
        "created_at": "2025-10-30T11:12:00.000Z",
        "block_number": 37516702,
        "transaction_hash": "0x...",
        "factory": "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"
      }
    ],
    "rpc_info": "Using default RPC. If experiencing rate limits, provide a custom rpc_url parameter"
  }
}
```

## Response Fields

### Common Fields (V2 & V3)
- `pair_address`: Address of the pair/pool contract
- `tokens`: Array of token addresses in the pair (addresses only, no symbols)
- `init_liquidity`: Initial liquidity from first Mint event (e.g., "0.11 WETH / 5600000000 TOKEN")
- `top_holders`: Array of top LP token holder addresses
- `created_at`: ISO timestamp of pair creation
- `block_number`: Block number where pair was created
- `transaction_hash`: Transaction hash of pair creation
- `factory`: Factory address that created the pair
- `pool_type`: Either "v2" or "v3"

### V3-Specific Fields
- `fee`: Fee tier in basis points (e.g., "3000" = 0.3%)
- `tick_spacing`: Tick spacing parameter for V3 pools

## Supported Pool Types

### Uniswap V2 Style (PairCreated Event)
- Uniswap V2
- SushiSwap
- PancakeSwap V2
- BaseSwap
- Most fork-based DEXs

### Uniswap V3 Style (PoolCreated Event)
- Uniswap V3
- PancakeSwap V3
- Other V3 implementations

The system automatically detects both event types from the same factory query.

## Supported Chains and Common Factories

| Chain | V2 Factories | V3 Factories |
|-------|-------------|--------------|
| **Ethereum** | Uniswap V2: `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f`<br>Sushiswap: `0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac` | Uniswap V3: `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| **Polygon** | Quickswap: `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32`<br>Sushiswap: `0xc35DADB65012eC5796536bD9864eD8773aBc74C4` | |
| **Arbitrum** | Camelot: `0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9`<br>Sushiswap: `0xc35DADB65012eC5796536bD9864eD8773aBc74C4` | |
| **Base** | BaseSwap V2: `0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6`<br>Aerodrome V2: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | Uniswap V3: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| **BSC** | PancakeSwap V2: `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` | PancakeSwap V3: `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` |
| **Optimism** | Velodrome: `0x25CbdDb98b35ab1FF77413456B31EC81A6B6B746` | |

## Architecture

The agent uses an on-demand architecture with dual event detection:

1. **RPC Query**: When API is called, connects to the specified chain's RPC
2. **Dual Event Filtering**: Uses `eth_getLogs` to query both `PairCreated` (V2) and `PoolCreated` (V3) events simultaneously
3. **Block Range Calculation**: Calculates blocks based on time window and chain's block time
4. **Validation**: Validates events to ensure they're legitimate pair/pool creations
5. **Initial Liquidity Detection**: Fetches actual initial liquidity by reading the first Mint event (V2 or V3)
6. **Enrichment**: Fetches token metadata and top holders
7. **Caching**: Caches results for 60 seconds to reduce RPC calls
8. **x402 Settlement**: Processes payment via facilitator before returning results

### Why Read Mint Events for Liquidity?

The system reads the first `Mint` event instead of calling `getReserves()` because:
- **Accuracy**: `getReserves()` returns current reserves (after trading), not initial liquidity
- **True Initial Value**: Mint events capture the exact amounts deposited when liquidity was first added
- **V2 & V3 Support**: Both V2 and V3 pools emit Mint events with amount0/amount1 parameters

## Performance

- **Detection Latency**: 2-10 seconds (depending on RPC and chain)
- **False Positive Rate**: <1% through validation pipeline
- **Cache TTL**: 60 seconds
- **Top Holders**: Limited to top 5 for performance
- **Rate Limiting**: 100ms delay between pairs, 50ms between token fetches

## Payment Integration

This agent uses the [x402 payment protocol](https://github.com/coinbase/x402) for monetization:

- **Protocol**: x402 (HTTP 402 Payment Required)
- **Network**: Base mainnet
- **Asset**: USDC (6 decimals)
- **Price**: $0.03 per request
- **Payment Method**: EIP-3009 transferWithAuthorization

Users must have USDC on Base and sign an authorization to make requests.

## Available Scripts

- `npm run dev` – Start the agent in watch mode
- `npm run build` – Build TypeScript to JavaScript
- `npm run start` – Start the agent once
- `npx tsc --noEmit` – Type-check the project

## Development

### Running with Bun

If you have Bun installed:
```sh
bun install
bun run dev
```

### Running with Node.js

```sh
npm install
npm run dev
```

### Type Checking

```bash
npx tsc --noEmit
```

## Testing with x402

Use the `x402-axios` package to test payments:

```typescript
import axios from "axios";
import { withPaymentInterceptor, createSigner } from "x402-axios";

const privateKey = process.env.PRIVATE_KEY;
const signer = await createSigner("base", privateKey);

const api = withPaymentInterceptor(
  axios.create({ baseURL: "http://localhost:8787" }),
  signer
);

const response = await api.post("/entrypoints/list/invoke", {
  input: {
    chain: "base",
    factories: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6,0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    window_minutes: "10",
    rpc_url: "https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
  }
});

console.log(response.data);
```

## Deployment

This agent can be deployed on platforms supporting Node.js/Bun with x402 payment processing:

- **Railway**: Deploy with included configuration
- **Vercel**: Deploy as edge functions
- **AWS Lambda**: Package as Lambda function
- **Docker**: Build container and deploy anywhere
- **VPS**: Run with PM2 or systemd

Ensure the deployed instance can access:
- The configured facilitator URL
- Base mainnet RPC for payment settlement
- Target chain RPCs for pair detection

## License

MIT
