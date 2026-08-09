# Contributing to Stamped

Read this before you install anything. The previous repo became uninstallable because
hand-edited, mismatched dependency versions piled up (a modern `expo` core next to
~SDK-46/2022 `expo-location`, plus a react / react-native peer conflict). Every rule below
exists to stop that from happening again. Follow them and installs stay boringly reliable.

---

## 1. Prerequisites

- **Node 22 LTS via nvm.** Do not use Node 24/latest — it's ahead of the Expo tooling and
  breaks installs. The repo pins this:
  - `.nvmrc` → `22`
  - root `package.json` → `"engines": { "node": ">=22 <25" }`
  - `.npmrc` → `engine-strict=true` (a teammate on the wrong Node gets a hard error, not a
    mystery failure)

```bash
nvm install 22 && nvm use 22   # run `nvm use` every time you open the repo
node -v                        # expect v22.x
```

- **Expo SDK 57** is the baseline (React Native 0.87). Everyone stays on one SDK.

---

## 2. First-time setup

```bash
git clone <repo-url> stamped
cd stamped
nvm use                 # reads .nvmrc → Node 22
npm install             # installs ALL workspaces from the repo root
```

Always run `npm install` from the **repo root**, never inside `apps/mobile`. Workspaces
hoist and dedupe dependencies across the repo; installing inside a sub-package corrupts that.

Run the mobile app:

```bash
cd apps/mobile
npx expo start          # then press i / a, or scan with a dev build on a real device
```

---

## 3. THE DEPENDENCY RULES (the ones that matter)

1. **Add Expo / React Native packages only with `npx expo install <pkg>`.**
   Never `npm install expo-something`. `expo install` picks the version that matches our SDK;
   plain `npm install` grabs "latest" and reintroduces the exact mismatch that killed the old
   repo.

2. **Never hand-edit a version number in any `package.json`.** If you think a version is
   wrong, run `npx expo install --fix` (from `apps/mobile`) — it realigns every package to the
   current SDK. Don't guess.

3. **Run `npx expo-doctor` before every push** (from `apps/mobile`). It catches version
   mismatches and config problems before they reach anyone else's machine.

4. **Commit `package-lock.json`.** Always. It's how everyone installs the same tree.

5. **One SDK for the whole team.** SDK upgrades happen on a branch, deliberately, via
   `npx expo install expo@^<next> --fix` — never piecemeal.

If an install ever fails, the fix is almost always: `nvm use`, delete `node_modules` +
`package-lock.json`, `npm install` from root, then `npx expo install --fix`. It is almost
never your machine.

---

## 4. Monorepo config (why the files look the way they do)

**Root `package.json`** — declares workspaces and pins Node:

```json
{
  "name": "stamped",
  "private": true,
  "packageManager": "npm@10",
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=22 <25" }
}
```

**`apps/mobile/metro.config.js`** — lets Metro resolve `@stamped/shared` across the repo.
Without this you get "unable to resolve @stamped/shared":

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
module.exports = config;
```

**`packages/shared/package.json`** — the shared contract (types/schemas). Import it in the app
as `@stamped/shared`:

```json
{ "name": "@stamped/shared", "version": "0.0.0", "main": "src/index.ts", "private": true }
```

---

## 5. The Python backend (`services/api`)

Not part of the npm workspaces. It has its own environment — do **not** `npm install` it.

```bash
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

For the current milestone (trip grouping) the backend is not needed — GPS extraction,
reverse geocoding, and clustering all run on-device. Touch `services/api` only when we add
something the phone can't do (POI lookups, cross-user sync).

---

## 6. Before you open a PR

- [ ] `nvm use` (Node 22)
- [ ] `npx expo-doctor` passes (from `apps/mobile`)
- [ ] No hand-edited version numbers; any new dep added via `npx expo install`
- [ ] `package-lock.json` committed if dependencies changed
- [ ] Shared types updated in `packages/shared` if the data shape changed
