# X402 Payload Structure Fix

## The Problem

The x402 system is sending a malformed payload where array fields get flattened to the root level with dotted names:

**What x402 sends:**
```json
{
  "input": {
    "chain": "base",
    "window_minutes": "1"
  },
  "input.factories": ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD"]
}
```

**What we expect:**
```json
{
  "input": {
    "chain": "base",
    "window_minutes": "1",
    "factories": ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD"]
  }
}
```

## The Solution

The agent now handles both formats by:

1. Checking for fields at the root level with "input." prefix
2. Moving them into the proper nested structure
3. Processing the normalized input

## Code Changes

```typescript
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

  // ... rest of handler
}
```

## Testing

The agent now accepts both formats:

### Standard Format (Recommended)
```bash
curl -X POST https://your-app.railway.app/entrypoint/list \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "chain": "base",
      "factories": ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD"],
      "window_minutes": 1
    }
  }'
```

### X402 Format (Automatically Handled)
```bash
curl -X POST https://your-app.railway.app/entrypoint/list \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "chain": "base",
      "window_minutes": "1"
    },
    "input.factories": ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD"]
  }'
```

Both will work correctly now!

## Debug Information

If an error occurs, the response now includes debug information showing:
- `rawRequest`: The exact payload received
- `processedInput`: The normalized input after fixing the structure

This helps diagnose any payload formatting issues.