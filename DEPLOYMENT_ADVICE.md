# Next.js Azure App Service デプロイ課題アドバイス

このドキュメントは、Next.jsアプリケーションをAzure App Serviceにデプロイする課題に取り組む人向けのアドバイスです。

---

## 最も重要なポイント

### 1. **GitHub Actions ワークフローの環境変数設定を最初に確認**

```yaml
- name: npm install, build, and test
  env:
    NEXT_PUBLIC_API_ENDPOINT: ${{ secrets.NEXT_PUBLIC_API_ENDPOINT }}
  run: npm run build
```

**⚠️ 重要**: GitHub Secretsに登録しても、`env:` ブロックで明示的に渡さないとビルド時に使えない。Azureが自動生成するワークフローには`env:`が含まれていないため、**必ず手動で追加する**こと。

---

### 2. **Next.js App Router の仕様を理解する**

課題のコードが古い可能性があります。以下を確認：

| 古い書き方（Pages Router） | 新しい書き方（App Router） |
|----------------------|----------------------|
| `export default function Page({ query })` | `export default function Page({ searchParams })` |
| `useSearchParams()` をそのまま使用 | `<Suspense>` でラップ必須 |

**症状**: `query is undefined` や `useSearchParams() should be wrapped in a suspense boundary` エラーが出たら、App Router対応が必要。

---

### 3. **standalone モードは必須**

```javascript
// next.config.js
const nextConfig = {
  output: 'standalone',  // ← これを追加
}
```

**理由**:
- Azure App Serviceで効率的にデプロイするため
- `server.js` が自動生成される（スタートアップコマンド `node server.js` で起動）
- デプロイサイズが1/10になる

**追加作業**: ワークフローで3つのフォルダを組み合わせる必要がある
```yaml
cp -r ./.next/standalone/. ./deploy
cp -r ./.next/static ./deploy/.next/static
if [ -d "./public" ]; then cp -r ./public ./deploy/public; fi
```

---

### 4. **ワークフローの構造を理解する**

提示されたワークフローコードには**重要な処理が抜けている**可能性が高い：

| 必須処理 | 説明 |
|---------|------|
| ✅ `env:` 設定 | ビルド時に環境変数を渡す |
| ✅ ファイルコピー | standalone, static, public を組み合わせる |
| ✅ zip化 | `cd deploy && zip -r ../release.zip .` |
| ✅ Unzip | デプロイジョブで `unzip release.zip -d deploy` |
| ✅ package指定 | `package: ./deploy` |

**注意**: zip時に`deploy`フォルダごとzipすると、デプロイ後のパスが`deploy/server.js`になり失敗する。必ず`cd deploy`してからzipすること。

---

### 5. **エラーメッセージから原因を特定する**

| エラーメッセージ | 原因 | 対処法 |
|---------------|------|-------|
| `Failed to collect page data for /customers/check` | `query`が存在しない（App Router非対応） | `searchParams`に変更 + `export const dynamic = 'force-dynamic'` 追加 |
| `useSearchParams() should be wrapped in a suspense boundary` | Suspenseでラップされていない | `<Suspense>` でラップ |
| `NEXT_PUBLIC_API_ENDPOINT is not defined` | ワークフローの`env:`設定漏れ | GitHub Secretsだけでなく、ワークフローに`env:`を追加 |
| デプロイ後 `Application Error` | `server.js`が存在しない | `output: 'standalone'`を追加 |

---

### 6. **デバッグのコツ**

#### ステップ1: ローカルで先にビルドしてみる
```bash
NEXT_PUBLIC_API_ENDPOINT=https://example.com npm run build
```
- ビルドが成功するか確認
- `.next/standalone/server.js` が生成されるか確認

#### ステップ2: GitHub Actions のログを丁寧に読む
- どのステップで失敗しているか特定
- エラーメッセージの前後の文脈を確認

#### ステップ3: 段階的に修正する
1. まずビルドを成功させる（App Router対応 + 環境変数）
2. 次にワークフローを修正（standalone対応）
3. 最後にデプロイを確認

---

### 7. **オプション vs 必須を理解する**

| 修正内容 | 必須/オプション |
|---------|--------------|
| ワークフローの`env:`設定 | **必須** |
| `output: 'standalone'` | **必須**（Azure推奨） |
| `query` → `searchParams` | **必須** |
| `<Suspense>`ラップ | **必須** |
| `src/lib/config.js`作成 | オプション（デバッグが楽になる） |
| 9つのfetchファイル修正 | オプション（`env:`設定があれば不要） |

---

## 作業の優先順位

### ステップ1: ビルドを成功させる
1. ワークフローに`env: NEXT_PUBLIC_API_ENDPOINT`を追加
2. App Router対応（`query` → `searchParams`, `<Suspense>`）
3. `next.config.js`に`output: 'standalone'`追加

### ステップ2: ワークフローを修正
1. standalone ファイルのコピー処理を追加
2. zip/unzip処理を正しく実装
3. `package: ./deploy`を指定

### ステップ3: デプロイ後の確認
1. Azure App Serviceのログを確認
2. スタートアップコマンドが`node server.js`になっているか確認

---

## よくある誤解

### ❌ 誤解1: GitHub Secretsに登録すれば自動的に使える
**正解**: ワークフローで明示的に`env:`ブロックで渡す必要がある

### ❌ 誤解2: 提示されたワークフローコードは完璧
**正解**: 多くの場合、重要な処理（env設定、unzip等）が抜けている

### ❌ 誤解3: `node server.js` でstandaloneモードになる
**正解**: `next.config.js`の`output: 'standalone'`設定が必要。`node server.js`は起動コマンド

### ❌ 誤解4: `src/lib/config.js` は必須
**正解**: オプション。環境変数が正しく設定されていれば不要（デバッグは楽になる）

---

## Next.js ビルドモードの理解

### 通常モード（デフォルト）
```javascript
// next.config.js - 設定なし
```
- `node_modules/` 全体が必要（500MB〜1GB）
- 起動コマンド: `npm start` または `next start`
- Azure App Serviceには不向き

### standalone モード（推奨）
```javascript
// next.config.js
const nextConfig = {
  output: 'standalone',
}
```
- 必要最小限のファイルのみ（50MB〜100MB）
- 起動コマンド: `node server.js`
- Azure App Serviceに最適

### 静的エクスポート
```javascript
// next.config.js
const nextConfig = {
  output: 'export',
}
```
- 完全な静的HTML
- サーバー不要
- **今回の課題では使用不可**（Server Components, 動的レンダリングが必要）

---

## standalone モードの詳細

### 生成されるファイル構造

```
ビルド後:
├── .next/standalone/   # ← サーバーコードと依存関係のみ
│   ├── server.js      # 自動生成されるエントリーポイント
│   ├── package.json
│   └── node_modules/  # 必要最小限
├── .next/static/       # ← 静的アセット（JS, CSS等）
└── public/             # ← 公開ファイル（画像等）
```

### デプロイ用に組み合わせる必要がある

```
deploy/
├── server.js              # .next/standalone/ から
├── package.json           # .next/standalone/ から
├── node_modules/          # .next/standalone/ から
├── .next/
│   └── static/           # .next/static/ から（手動コピー必要）
└── public/               # public/ から（手動コピー必要）
```

**重要**: Next.jsは自動的に`standalone/`に static と public を含めないため、ワークフローで手動コピーが必須。

---

## GitHub Actions ワークフローの完全な構造

### ビルドジョブ

```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20.x'

    # ⭐ 重要: 環境変数を設定
    - name: npm install, build, and test
      env:
        NEXT_PUBLIC_API_ENDPOINT: ${{ secrets.NEXT_PUBLIC_API_ENDPOINT }}
      run: |
        npm install
        npm run build --if-present

    # ⭐ 重要: standalone ファイルを組み合わせる
    - name: Copy artifact for deployment job
      run: |
        mkdir -p deploy
        cp -r ./.next/standalone/. ./deploy
        cp -r ./.next/static ./deploy/.next/static
        if [ -d "./public" ]; then cp -r ./public ./deploy/public; fi

    # ⭐ 重要: deploy フォルダ内でzip
    - name: Zip artifact for deployment
      run: cd deploy && zip -r ../release.zip .

    - name: Upload artifact for deployment job
      uses: actions/upload-artifact@v4
      with:
        name: node-app
        path: release.zip  # ← zipファイルのみ
```

### デプロイジョブ

```yaml
deploy:
  runs-on: ubuntu-latest
  needs: build
  steps:
    - name: Download artifact from build job
      uses: actions/download-artifact@v4
      with:
        name: node-app

    # ⭐ 重要: zipを解凍
    - name: Unzip artifact for deployment
      run: unzip release.zip -d deploy

    - name: 'Deploy to Azure Web App'
      uses: azure/webapps-deploy@v3
      with:
        app-name: 'your-app-name'
        slot-name: 'Production'
        package: ./deploy  # ← deploy フォルダを指定
        publish-profile: ${{ secrets.AZUREAPPSERVICE_PUBLISHPROFILE_XXX }}
```

---

## App Router 対応の詳細

### 問題1: `query` パラメータ（Pages Router）

```javascript
// ❌ 古い（Pages Router）
export default async function Page({ query }) {
  const { id } = query;  // query は undefined
}

// ✅ 新しい（App Router）
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  const id = searchParams?.id;

  if (!id) {
    return <div>IDが指定されていません</div>;
  }
  // ...
}
```

### 問題2: `useSearchParams()` のSuspense

```javascript
// ❌ 古い
"use client";
export default function Page() {
  const searchParams = useSearchParams();
  // ...
}

// ✅ 新しい
"use client";
import { Suspense } from "react";

function PageContent() {
  const searchParams = useSearchParams();
  // ...
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageContent />
    </Suspense>
  );
}
```

---

## 最後に

**提示されたコードが「完全に正しい」とは限りません。**

- エラーメッセージを丁寧に読む
- 公式ドキュメント（Next.js, Azure App Service）を確認する
- **自分で考えて修正する力**が重要

課題の目的は、単にデプロイすることではなく、**トラブルシューティング能力を身につけること**です。

---

## 参考リソース

- [Next.js 公式ドキュメント - App Router](https://nextjs.org/docs/app)
- [Next.js 公式ドキュメント - Output File Tracing (standalone)](https://nextjs.org/docs/pages/api-reference/next-config-js/output)
- [Azure App Service ドキュメント](https://learn.microsoft.com/azure/app-service/)
- [GitHub Actions ドキュメント](https://docs.github.com/actions)
