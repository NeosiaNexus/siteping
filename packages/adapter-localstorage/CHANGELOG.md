# Changelog

## [0.4.3](https://github.com/NeosiaNexus/SitePing/compare/adapter-localstorage-v0.4.2...adapter-localstorage-v0.4.3) (2026-04-04)


### Features

* add adapter-memory, adapter-localstorage, and widget store mode ([efa8b64](https://github.com/NeosiaNexus/SitePing/commit/efa8b64197d1a612146b0c988f1b708cd594b373))

## 0.4.2 (2026-04-04)

### Features

- Initial release
- `LocalStorageStore` implementing `SitepingStore` interface
- Data persists across page reloads via `localStorage`
- JSON date serialization/deserialization
- Graceful handling of corrupted data and storage limits
- `clear()` method for removing all persisted data
