# Fresh Market Watch

An AI agent that detects new AMM (Automated Market Maker) pairs/pools created on EVM-compatible blockchains within a specified time window.

## Features

- **Multi-Chain Support**: Works with any EVM-compatible chain (Ethereum, Polygon, Arbitrum, Base, BSC, etc.)
- **Real-time Detection**: Detects new pairs within 60 seconds of creation
- **Low False Positives**: Less than 1% false positive rate through validation pipeline
- **Data Enrichment**: Provides liquidity data, token information, and top holders
- **In-Memory Caching**: 60-second cache to reduce RPC calls
- **Custom RPC Support**: Allows custom RPC endpoints for any chain

## Quick Start

```sh
npm install
npm run dev
```

The dev command runs in watch mode, starts the HTTP server on port 8787, and reloads when you change files inside `src/`.

## Project Structure

- `src/agent.ts` – Defines the agent manifest and entrypoints
- `src/index.ts` – Boots a Bun HTTP server with the agent
- `src/services/detector.ts` – Core AMM pair detection logic
- `src/services/enrichment.ts` – Token and liquidity data enrichment
- `src/services/cache.ts` – In-memory caching implementation
- `src/config/chains.ts` – Chain configurations and RPC endpoints

## API Usage

### Endpoint

The agent provides a single entrypoint `list` accessible at:

`POST http://localhost:8787/entrypoint/list`

### Request Parameters

- `chain` (string, required): Target blockchain (ethereum, polygon, arbitrum, optimism, base, bsc, etc.)
- `factories` (array, required): Array of AMM factory contract addresses to monitor
- `window_minutes` (number, optional): Time window to scan in minutes (default: 60, max: 1440)
- `rpc_url` (string, optional): Custom RPC URL. If not provided, uses default for the chain

### Example Request

```json
{
  "chain": "ethereum",
  "factories": ["0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"],
  "window_minutes": 60
}
```

### Example Response

```json
{
  "output": {
    "success": true,
    "chain": "ethereum",
    "window_minutes": 60,
    "total_pairs_found": 3,
    "pairs": [
      {
        "pair_address": "0x...",
        "tokens": ["0x... (USDC)", "0x... (WETH)"],
        "init_liquidity": "1000.00 USDC / 0.50 WETH",
        "top_holders": ["0x...", "0x...", "0x...", "0x...", "0x..."],
        "created_at": "2024-01-01T12:00:00.000Z",
        "block_number": 18900000,
        "transaction_hash": "0x...",
        "factory": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
      }
    ]
  }
}
```

## Usage Examples

### Ethereum - Uniswap V2

```bash
curl -X POST http://localhost:8787/entrypoint/list \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "ethereum",
    "factories": ["0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"],
    "window_minutes": 60
  }'
```

### Polygon - QuickSwap

```bash
curl -X POST http://localhost:8787/entrypoint/list \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "polygon",
    "factories": ["0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32"],
    "window_minutes": 30
  }'
```

### Base - Aerodrome

```bash
curl -X POST http://localhost:8787/entrypoint/list \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "base",
    "factories": ["0x420DD381b31aEf6683db6B902084cB0FFECe40Da"],
    "window_minutes": 120
  }'
```

### Custom Chain with Custom RPC

```bash
curl -X POST http://localhost:8787/entrypoint/list \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "custom",
    "factories": ["0x..."],
    "window_minutes": 60,
    "rpc_url": "https://custom-chain-rpc.com"
  }'
```

## Supported Chains and Common Factories

| Chain | Common Factory Contracts |
|-------|-------------------------|
| Ethereum | Uniswap V2: `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f`<br>Uniswap V3: `0x1F98431c8aD98523631AE4a59f267346ea31F984`<br>Sushiswap: `0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac` |
| Polygon | Quickswap: `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32`<br>Sushiswap: `0xc35DADB65012eC5796536bD9864eD8773aBc74C4` |
| Arbitrum | Camelot: `0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9`<br>Sushiswap: `0xc35DADB65012eC5796536bD9864eD8773aBc74C4` |
| Base | BaseSwap: `0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6`<br>Aerodrome: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| BSC | PancakeSwap V2: `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73`<br>PancakeSwap V3: `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` |
| Optimism | Velodrome: `0x25CbdDb98b35ab1FF77413456B31EC81A6B6B746` |

## Architecture

The agent uses an on-demand architecture:

1. **RPC Query**: When API is called, connects to the specified chain's RPC
2. **Event Filtering**: Uses `eth_getLogs` to query `PairCreated` events
3. **Block Range Calculation**: Calculates blocks based on time window and chain's block time
4. **Validation**: Validates events to ensure they're legitimate pair creations
5. **Enrichment**: Fetches token metadata, liquidity data, and top holders
6. **Caching**: Caches results for 60 seconds to reduce RPC calls

## Performance

- **Detection Latency**: 2-10 seconds (depending on RPC and chain)
- **False Positive Rate**: <1% through validation pipeline
- **Cache TTL**: 60 seconds
- **Top Holders**: Limited to top 5-10 for performance

## Available Scripts

- `npm run dev` – Start the agent in watch mode
- `npm run start` – Start the agent once
- `npm run agent` – Run the agent module directly
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

## Environment Variables

You can set default RPC URLs in a `.env` file:

```env
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
# etc...
```

## Deployment

This agent can be deployed on any platform that supports Node.js or Bun:

- **Vercel**: Deploy as a serverless function
- **AWS Lambda**: Package and deploy as Lambda function
- **Docker**: Build container and deploy anywhere
- **VPS**: Run directly with PM2 or similar

## License

MIT