# @kora/extension-sdk

TypeScript SDK for building extensions on the [Kora](https://github.com/asenawritescode/kora) platform.

## Installation

```bash
npm install @kora/extension-sdk
```

## Quick Start

```typescript
import { KoraClient } from '@kora/extension-sdk'

const kora = new KoraClient({
  baseUrl: 'https://myapp.kora.dev',
  token: 'kxt_your_extension_token'
})

// Create a validation script
const script = await kora.createScript({
  name: 'validate_order',
  script_type: 'doc_event',
  doctype: 'Order',
  event: 'before_save',
  script: `kora.log.info('Validating order:', event.doc.name);
if (!event.doc.total || event.doc.total <= 0) {
  throw new Error('Total must be greater than zero');
}
return { doc: event.doc };`
})

// Call a custom API method
const result = await kora.callMethod('send_invoice', { orderId: 'ORD-0001' })
```

## API Reference

### KoraClient

- `callMethod(name, body?)` — Execute a custom API method
- `listScripts()` — List all scripts
- `getScript(name)` — Get script by name
- `createScript(req)` — Create a new script
- `updateScript(name, req)` — Update a script
- `deleteScript(name)` — Delete a script
- `getScriptExecutions(name)` — Get execution logs
- `validateScript(script)` — Validate script syntax
- `listExtensions()` — List all extensions
- `createExtension(req)` — Create a new extension
- `deleteExtension(name)` — Delete an extension
- `getDeliveries(name)` — Get webhook delivery logs
- `rotateSecret(name)` — Rotate extension HMAC secret

### Types

Full type definitions are exported for `ScriptRecord`, `ExtensionRecord`, `DeliveryRecord`, `ExecuteRequest`, `ExecuteResult`, and more.

## Versioning

This package follows [Semantic Versioning](https://semver.org/).

| SDK Version | Kora Engine | Node.js |
|---|---|---|
| 0.x | >= 0.7.1-alpha | >= 20.0.0 |

## License

MIT
