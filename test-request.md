# Test Request Examples

## Correct Request Format

The request must have the payload wrapped in an `input` field:

### Via cURL
```bash
curl -X POST https://your-railway-app.up.railway.app/entrypoint/list \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "chain": "base",
      "factories": ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD"],
      "window_minutes": 1
    }
  }'
```

### Via JavaScript/x402-axios
```javascript
const dataPayload = {
  input: {  // ← REQUIRED wrapper
    chain: "base",
    factories: ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD"],
    window_minutes: 1
  }
};

const response = await api.post("/entrypoint/list", dataPayload, {
  headers: {
    'Content-Type': 'application/json'
  }
});
```

## Common Mistakes

### ❌ WRONG - Missing input wrapper
```json
{
  "chain": "base",
  "factories": ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD"],
  "window_minutes": 1
}
```

### ❌ WRONG - window_minutes as string (should be number)
```json
{
  "input": {
    "chain": "base",
    "factories": ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD"],
    "window_minutes": "1"  // Should be 1, not "1"
  }
}
```

### ✅ CORRECT
```json
{
  "input": {
    "chain": "base",
    "factories": ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD"],
    "window_minutes": 1
  }
}
```

## Testing Your Deployment

1. **Test with a simple query (Base Aerodrome)**
```bash
curl -X POST https://your-railway-app.up.railway.app/entrypoint/list \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "chain": "base",
      "factories": ["0x420DD381b31aEf6683db6B902084cB0FFECe40Da"],
      "window_minutes": 60
    }
  }'
```

2. **Test with custom RPC**
```bash
curl -X POST https://your-railway-app.up.railway.app/entrypoint/list \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "chain": "base",
      "factories": ["0x33128a8fC17869897dcE68Ed026d694621f6FDfD"],
      "window_minutes": 30,
      "rpc_url": "https://mainnet.base.org"
    }
  }'
```