import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { detectNewPairs } from "./services/detector";

// Adjust these options to configure payments, trust metadata, or AP2 metadata.
const agentOptions = {
  config: {
    payments: {
      facilitatorUrl: "https://facilitator.daydreams.systems" as `${string}://${string}`,
      payTo: "0x4Dec2Ac51E74EDFCFFA084A14A008FaA9E6F739c" as `0x${string}`,
      network: "base" as "base",
      defaultPrice: "100000",
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
    factories: z.array(z.string()).describe("Array of AMM factory contract addresses to monitor"),
    window_minutes: z.union([
      z.number(),
      z.string().transform((val) => parseInt(val, 10))
    ]).refine((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return !isNaN(num) && num >= 1 && num <= 1440;
    }, {
      message: "window_minutes must be between 1 and 1440"
    }).default(60).describe("Time window to scan in minutes (default: 60, max: 1440)"),
    rpc_url: z.string().optional().describe("Optional custom RPC URL. If not provided, uses default for the chain"),
  }),
  price: "0.03",

  handler: async (request) => {
    // Handle malformed x402 payload structure
    const rawRequest = request as any;

    // Check if factories is at root level as "input.factories"
    let input = rawRequest.input || {};

    if (rawRequest["input.factories"] && !input.factories) {
      input.factories = rawRequest["input.factories"];
    }

    // Also check for other potentially misplaced fields
    if (rawRequest["input.rpc_url"] && !input.rpc_url) {
      input.rpc_url = rawRequest["input.rpc_url"];
    }
    try {
      // Debug logging
      console.log('Raw request:', JSON.stringify(rawRequest, null, 2));
      console.log('Processed input:', JSON.stringify(input, null, 2));

      // Validate required fields
      if (!input.chain) {
        throw new Error('chain is required');
      }
      if (!input.factories || !Array.isArray(input.factories)) {
        throw new Error('factories must be an array of contract addresses');
      }

      // Ensure window_minutes is a number
      const windowMinutes = typeof input.window_minutes === 'string'
        ? parseInt(input.window_minutes, 10)
        : input.window_minutes;

      const pairs = await detectNewPairs({
        chain: input.chain,
        factories: input.factories,
        windowMinutes: windowMinutes || 60,
        rpcUrl: input.rpc_url,
      });

      return {
        output: {
          success: true,
          chain: input.chain,
          window_minutes: input.window_minutes,
          total_pairs_found: pairs.length,
          pairs: pairs,
        },
      };
    } catch (error) {
      console.error('Error processing request:', error);
      return {
        output: {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          debug: {
            rawRequest: rawRequest,
            processedInput: input
          }
        },
      };
    }
  },
});

export { app };
