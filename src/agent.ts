import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { detectNewPairs } from "./services/detector";

// Load environment variables with defaults
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.payai.network";
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS || "0x4Dec2Ac51E74EDFCFFA084A14A008FaA9E6F739c";
const PAYMENT_NETWORK = process.env.PAYMENT_NETWORK || "base";
const DEFAULT_PRICE = process.env.DEFAULT_PRICE || "100000";
const ENTRYPOINT_PRICE = process.env.ENTRYPOINT_PRICE || "0.03";

// Adjust these options to configure payments, trust metadata, or AP2 metadata.
const agentOptions = {
  config: {
    payments: {
      facilitatorUrl: FACILITATOR_URL as `${string}://${string}`,
      payTo: PAY_TO_ADDRESS as `0x${string}`,
      network: PAYMENT_NETWORK as "base",
      defaultPrice: DEFAULT_PRICE,
    },
  },
  useConfigPayments: true,
};

const { app, addEntrypoint } = createAgentApp(
  {
    name: "fresh-market-watch",
    version: "0.0.1",
    description: "List new AMM pairs or pools in the last few minutes.",
  },
  agentOptions
);

addEntrypoint({
  key: "list",
  description: "List new AMM pairs created on specified chain within the time window",
  input: z.object({
    chain: z.string().describe("Target blockchain (ethereum, polygon, arbitrum, optimism, base, bsc, etc.)"),
    factories: z.string().describe("Array of AMM factory contract addresses to monitor, sepererate by ,"),
    window_minutes: z.string().min(1).max(2).describe("Time window to scan in minutes (default: 60, max: 1440)"),
    rpc_url: z.string().optional().describe("Optional custom RPC URL. If not provided, uses default for the chain"),
  }),
  price: ENTRYPOINT_PRICE,
  handler: async ({ input }) => {
    const pairs = await detectNewPairs({
      chain: input.chain,
      factories: input.factories.split(","),
      windowMinutes: parseInt(input.window_minutes) || 1,
      rpcUrl: input.rpc_url,
    });


    return {
      output: {
        success: true,
        chain: input.chain,
        window_minutes: input.window_minutes,
        total_pairs_found: pairs.length,
        pairs: pairs,
        rpc_info: input.rpc_url
          ? `Using custom RPC: ${input.rpc_url}`
          : `Using default RPC. If experiencing rate limits, provide a custom rpc_url parameter`,
      },
    };
  },
});

export { app };
