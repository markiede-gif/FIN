# Financial Position

A personal finance dashboard (Dashboard, Budget, Transactions/CSV import, Net Worth, Investments, Assumptions, Constitution) built with Vite + React.

## Development

```
npm install
npm run dev
```

## Data storage

App state is persisted to the browser's `localStorage` (debounced ~400ms after each change). Data is per-browser/device only — use the Export JSON button on the Constitution tab to back up or move data.
