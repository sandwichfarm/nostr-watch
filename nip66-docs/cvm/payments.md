# Payments

CVM supports optional micro-payments for tool calls using the CEP-8 pricing protocol. Most tools are free -- payments are an opt-in feature for operators who want to gate premium queries.

## How It Works

When a CVM server has payment gating enabled, each tool call that costs money follows this flow:

1. **Client calls a tool** -- the server checks if the tool has a price
2. **Server returns a payment request** -- includes amount, currency, and payment method
3. **Client pays** -- via L402 (Lightning) or P2PK (Cashu)
4. **Server processes the tool call** -- returns results after payment confirmation

Free tools (amount = 0) skip this flow entirely.

## Payment Methods

### L402 (Lightning)

L402 uses Lightning Network invoices for payment. The server generates an invoice, the client pays it, and includes the preimage as proof of payment.

### P2PK (Cashu)

Cashu ecash tokens can be used for payment. Tokens are locked to the server's pubkey (P2PK), ensuring only the server can redeem them.

## Pricing Configuration

Operators configure pricing via a YAML file:

```bash
# Set the pricing file path
export PRICING_YAML=./pricing.yaml

# Optional: CVM-specific price overrides
export CVM_PRICING_YAML=./cvm-pricing-override.yaml
```

The pricing file maps tool names to amounts:

```yaml
# pricing.yaml
- name: relays/list
  amount: 0
  currencyUnit: sat
  description: List relays (free)

- name: relays/search
  amount: 0
  currencyUnit: sat
  description: Search relays (free)

- name: relays/nearby
  amount: 1
  currencyUnit: sat
  description: Geospatial relay query
```

Only entries with `amount > 0` activate payment gating. All other tools remain free.

## CEP-8 Format

Prices are advertised in the CEP-8 `PricedCapability` format:

```json
{
  "method": "tools/call",
  "name": "relays/nearby",
  "amount": 1,
  "currencyUnit": "sat",
  "description": "Geospatial relay query"
}
```

## For Consumers

If you're **consuming** CVM tools from an existing server:

- **Most tools are free.** The nostr.watch public CVM does not currently charge for basic queries.
- **Check the server's pricing** by examining its advertised capabilities.
- **Self-host to avoid payments entirely.** Running your own rstate instance means you control pricing (or disable it).

## For Operators

If you're **running** your own rstate instance:

- Set `PRICING_YAML` to enable payment gating
- Configure L402 or Cashu payment methods in your config
- Use `CVM_PRICING_YAML` to set CVM-specific overrides separate from REST pricing
- Free tools don't need entries in the pricing file
