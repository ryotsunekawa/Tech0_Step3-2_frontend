# Azure App Service デプロイ修正ドキュメント

## 概要

このドキュメントでは、Next.jsアプリケーションをAzure App Serviceにデプロイする際に発生した問題と、その修正内容を説明します。

---

## 重要な注意事項

### **`src/lib/config.js` は必須ではない**

**結論**: 環境変数（`NEXT_PUBLIC_API_ENDPOINT`）が適切に設定されていれば、`src/lib/config.js` の作成と、9つのfetchファイルの修正は**不要です**。

#### **本質的に必要な修正**
1. ✅ **ワークフローファイルで環境変数を渡す**（必須）
2. ✅ **Next.js App Router対応**（必須）
   - `query` → `searchParams`
   - `useSearchParams()` を `<Suspense>` でラップ
3. ✅ **standalone モード設定**（必須）
4. ✅ **ワークフローでstandalone対応**（必須）

#### **オプションの修正（ベストプラクティス）**
- `src/lib/config.js` の作成
- 各ファイルでの `API_ENDPOINT` import

**位置づけ**: 管理コストを下げ、将来の問題を予防するための改善であり、機能的には必須ではありません。小規模プロジェクトでは省略可能です。

---

## 修正が必要だった理由

元のコードには以下の問題がありました：

1. **環境変数が未定義の状態でビルドが実行される**
2. **Next.js App Router（Next.js 13+）の新しいAPI仕様に対応していない古い書き方**
3. **Azure App Service向けのstandalone出力設定がない**
4. **GitHub Actionsワークフローでデプロイ用ファイルが正しく構成されていない**

---

## 修正内容の詳細

### 1. GitHub Actions ワークフローの環境変数設定（最重要）

#### **問題点**

**これが最も本質的な問題です**: GitHub Secretsに `NEXT_PUBLIC_API_ENDPOINT` を登録していても、**ワークフローファイルで明示的に `env:` で渡さないとビルドプロセスで利用できません**。

##### **なぜ環境変数が `undefined` になったのか**

1. **Azureの自動生成がワークフローファイルを上書き**
   ```yaml
   # 最初は手動で env: を追加していた
   - name: npm install, build, and test
     env:
       NEXT_PUBLIC_API_ENDPOINT: ${{ secrets.NEXT_PUBLIC_API_ENDPOINT }}
     run: npm run build

   # ↓ Azureが自動生成したワークフローで上書きされた
   - name: npm install, build, and test
     run: npm run build  # env: の設定が消えた！
   ```

2. **GitHub Secretsは自動的には使われない**
   - GitHub Secretsに登録しただけでは**ビルドプロセスで利用できない**
   - `env:` ブロックで明示的に指定する必要がある
   - セキュリティ上の理由で、必要なSecretsだけを明示的に取り出す設計

3. **Next.jsの `NEXT_PUBLIC_` プレフィックスはビルド時に埋め込まれる**
   ```javascript
   // ビルド時に環境変数がないと
   fetch(process.env.NEXT_PUBLIC_API_ENDPOINT + "/customers")
   // ↓ ビルド後のコードは以下のようになる
   fetch(undefined + "/customers")  // → fetch("undefined/customers")
   ```

**結果**: ビルド時のプリレンダリングでエラーが発生し、ビルドが失敗する

#### **修正内容（本質的な解決策）**

**ファイル**: `.github/workflows/main_tech0-gen-11-step3-2-node-45.yml`

```yaml
# 修正前
- name: npm install, build, and test
  run: |
    npm install
    npm run build --if-present
```

```yaml
# 修正後
- name: npm install, build, and test
  env:
    NEXT_PUBLIC_API_ENDPOINT: ${{ secrets.NEXT_PUBLIC_API_ENDPOINT }}  # ← これが必須！
  run: |
    npm install
    npm run build --if-present
```

**重要**: **この `env:` 設定さえあれば、以下は不要です**：
- `src/lib/config.js` の作成
- 9つのfetchファイルの修正

**効果**: ビルド時に環境変数が注入され、`NEXT_PUBLIC_` プレフィックスの変数が静的にバンドルされる

---

### 2. Next.js App Router対応（古いコードの修正）

#### **問題1: `query` パラメータの使用（Pages Routerの書き方）**

**ファイル**: `src/app/customers/check/page.jsx`

```javascript
// 修正前（Next.js Pages Routerの古い書き方）
export default async function ReadPage({ query }) {
  const { id } = query;  // Next.js 13+ App Routerでは動作しない
  // ...
}
```

**問題点**:
- `query` は Next.js Pages Router（古いルーティングシステム）の仕様
- App Router（Next.js 13以降）では `searchParams` を使用する必要がある
- `query` が `undefined` になり、分割代入でエラーが発生

```javascript
// 修正後（Next.js App Routerの正しい書き方）
export default async function ReadPage({ searchParams }) {
  const id = searchParams?.id;

  if (!id) {
    return (
      <div className="alert alert-error">
        IDが指定されていません
      </div>
    );
  }
  // ...
}
```

**追加修正**: 動的レンダリング設定
```javascript
export const dynamic = 'force-dynamic';
```

**効果**:
- ビルド時のプリレンダリングエラーを回避
- クエリパラメータが正しく取得できるようになる

---

#### **問題2: `useSearchParams()` がSuspenseでラップされていない**

**ファイル**: `src/app/customers/create/confirm/page.jsx`

```javascript
// 修正前（Next.js 13+では必須のSuspenseがない）
"use client";
export default function ConfirmPage() {
  const customer_id = useSearchParams().get("customer_id");
  // ...
}
```

**問題点**:
- Next.js 13以降、`useSearchParams()` を使用する場合は必ず `<Suspense>` でラップする必要がある
- ラップしないとビルド時に以下のエラーが発生：
  ```
  useSearchParams() should be wrapped in a suspense boundary
  ```

```javascript
// 修正後
"use client";
import { Suspense } from "react";

function ConfirmPageContent() {
  const customer_id = useSearchParams().get("customer_id");
  // ...
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmPageContent />
    </Suspense>
  );
}
```

**効果**:
- ビルドが成功する
- ページ読み込み中のローディング状態を適切に管理できる
- React 18のConcurrent Rendering機能に対応

---

### 3. Next.js standalone モードの設定（Azure App Service向け最適化）

#### **standalone モードとは**

Next.jsの `standalone` モードは、**本番環境向けに最小限のファイルセットを生成する**ビルドオプションです。

##### **通常のビルドとの違い**

**通常のビルド（デフォルト）**:
```
node_modules/        # すべての依存関係（500MB〜1GB級）
.next/
├── static/          # 静的ファイル
└── server/          # サーバーコード
package.json
```

**問題点**:
- `node_modules` フォルダ全体が必要（巨大）
- デプロイサイズが大きい（600MB〜）
- 起動が遅い

---

**standalone モード**:
```
.next/
├── standalone/      # 最小限のファイルセット（50MB程度）
│   ├── server.js    # スタンドアロンサーバー（自動生成）
│   ├── package.json # 必要な依存関係のみ
│   └── node_modules/# 必要なパッケージのみ（最小化）
├── static/          # 静的ファイル（10MB程度）
└── cache/
```

**メリット**:
- ✅ 必要最小限のファイルのみ（デプロイサイズ 1/10〜1/5）
- ✅ 起動が高速
- ✅ Dockerコンテナやクラウドデプロイに最適
- ✅ Azure App Serviceの制約（ファイルサイズ、起動時間）に対応

---

##### **なぜ3つのフォルダを組み合わせる必要があるのか**

standalone モードでは、ビルド結果が3箇所に分散されます：

```
ビルド後:
├── .next/standalone/   # ← サーバーコードと依存関係のみ
├── .next/static/       # ← 静的アセット（JS, CSS等）
└── public/             # ← 公開ファイル（画像等）
```

デプロイ時に正しく動作させるには、**これらを適切に組み合わせる**必要があります：

```
deploy/
├── server.js              # .next/standalone/ から
├── package.json           # .next/standalone/ から
├── node_modules/          # .next/standalone/ から（最小化）
├── .next/
│   └── static/           # .next/static/ から（手動コピー必要）
└── public/               # public/ から（手動コピー必要）
```

**理由**: Next.jsは自動的に `standalone/` に static と public を含めないため、手動で組み合わせる必要があります。

---

#### **問題点**
`next.config.js` に `output: 'standalone'` の設定がなかったため：

- Azure App Serviceで実行するための `server.js` が生成されない
- デプロイ時に必要なファイル構造が作成されない
- スタートアップコマンド `node server.js` が実行できない
- デプロイサイズが大きすぎてAzureの制限に引っかかる可能性

#### **修正内容**

**ファイル**: `next.config.js`

```javascript
// 修正前
const nextConfig = {
    env: {
        API_ENDPOINT: process.env.API_ENDPOINT,
    },
}
```

```javascript
// 修正後
const nextConfig = {
    output: 'standalone',  // ← 追加
    env: {
        API_ENDPOINT: process.env.API_ENDPOINT,
    },
}
```

**効果**:
- `.next/standalone/` ディレクトリに最小限のファイルセットが生成される
- `server.js` が自動生成され、Azure App Serviceで実行可能になる
- デプロイサイズが削減され（通常の1/10〜1/5）、起動速度が向上
- Azure App Serviceの制約（ファイルサイズ、起動時間）に対応

---

### 4. GitHub Actions ワークフローの standalone 対応

#### **問題点**

元のワークフローには以下の問題がありました：

1. **デプロイ用ファイルの構成が不完全**
2. **standalone出力のファイル構造に対応していない**

#### **修正内容**

**ファイル**: `.github/workflows/main_tech0-gen-11-step3-2-node-45.yml`

##### **修正1: デプロイ用ファイルのコピー**

```yaml
# 修正前（この処理自体が存在しなかった）

# 修正後
- name: Copy artifact for deployment job
  run: |
    mkdir -p deploy
    cp -r ./.next/standalone/. ./deploy
    cp -r ./.next/static ./deploy/.next/static
    if [ -d "./public" ]; then cp -r ./public ./deploy/public; fi
```

**理由**:
- Next.js standalone モードでは、以下の3つのディレクトリを手動で組み合わせる必要がある：
  - `.next/standalone/` - サーバーコードと依存関係
  - `.next/static/` - 静的アセット（JS, CSS等）
  - `public/` - 公開ファイル（画像等）

**ファイル構造**:
```
deploy/
├── server.js              # .next/standalone/ から
├── .next/
│   └── static/           # .next/static/ から
└── public/               # public/ から（存在する場合）
```

---

##### **修正2: アーティファクトのzip化**

```yaml
# 修正前（zip化されていなかった）
- name: Upload artifact for deployment job
  uses: actions/upload-artifact@v4
  with:
    name: node-app
    path: .  # すべてのファイルをアップロード（非効率）
```

```yaml
# 修正後
- name: Zip artifact for deployment
  run: cd deploy && zip -r ../release.zip .

- name: Upload artifact for deployment job
  uses: actions/upload-artifact@v4
  with:
    name: node-app
    path: release.zip  # zipファイルのみアップロード
```

**効果**:
- アップロード/ダウンロード時間が大幅に短縮
- 不要なファイル（node_modules等）が除外される

---

##### **修正3: デプロイステップの改善**

```yaml
# 修正前
- name: Download artifact from build job
  uses: actions/download-artifact@v4
  with:
    name: node-app

- name: 'Deploy to Azure Web App'
  uses: azure/webapps-deploy@v3
  with:
    package: .  # 全ファイルをデプロイ（不適切）
```

```yaml
# 修正後
- name: Download artifact from build job
  uses: actions/download-artifact@v4
  with:
    name: node-app

- name: Unzip artifact for deployment
  run: unzip release.zip -d deploy

- name: 'Deploy to Azure Web App'
  uses: azure/webapps-deploy@v3
  with:
    package: ./deploy  # standaloneファイルのみデプロイ
```

**効果**:
- 正しいファイル構造でAzureにデプロイされる
- デプロイサイズが最小化される

---

## 変更理由の要約表

| 修正箇所 | 変更理由 | 必須/オプション | 変更前の問題 | 変更後の効果 |
|---------|---------|--------------|-------------|-------------|
| **ワークフローの`env:`設定** | ビルド時に環境変数を渡す | **必須** | 環境変数が`undefined`でビルド失敗 | 環境変数が正しくバンドルされる |
| **`src/app/customers/check/page.jsx`** | Next.js App Router対応 | **必須** | `query`（Pages Router）を使用 | `searchParams`（App Router）で正しく動作 |
| **`src/app/customers/create/confirm/page.jsx`** | Suspense対応 | **必須** | `useSearchParams()` がラップされていない | ビルド成功、ローディング状態の適切な管理 |
| **`next.config.js`** | standalone モード有効化 | **必須** | `server.js` が生成されない | Azure App Serviceで実行可能 |
| **ワークフローの standalone 対応** | デプロイファイル構成 | **必須** | ファイル構成不適切 | 効率的なデプロイ |
| **`src/lib/config.js`（新規）** | 環境変数管理の一元化 | オプション | 環境変数未定義時に不明瞭なエラー | 明確なエラーメッセージでデバッグが容易 |
| **9つのfetchファイル修正** | `API_ENDPOINT` import | オプション | - | コードの可読性向上 |

---

## 古いコードパターンと新しい書き方

### 1. **Pages Router → App Router**

```javascript
// ❌ 古い（Pages Router - Next.js 12以前）
export default function Page({ query }) {
  const { id } = query;
}

// ✅ 新しい（App Router - Next.js 13以降）
export default function Page({ searchParams }) {
  const id = searchParams?.id;
}
```

---

### 2. **useSearchParams() の使用**

```javascript
// ❌ 古い（Suspense なし）
"use client";
export default function Page() {
  const searchParams = useSearchParams();
}

// ✅ 新しい（Suspense でラップ）
"use client";
import { Suspense } from "react";

function PageContent() {
  const searchParams = useSearchParams();
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

### 3. **環境変数の扱い（オプション）**

```javascript
// ✅ 基本形（ワークフローで env: 設定があれば十分）
const endpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
fetch(`${endpoint}/api`);

// ✅ より良い形（エラーハンドリング強化 - オプション）
// src/lib/config.js
export const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT;
if (!API_ENDPOINT) {
  throw new Error('環境変数が未定義');
}

// 使用側
import { API_ENDPOINT } from "@/lib/config";
fetch(`${API_ENDPOINT}/api`);
```

**注意**: `src/lib/config.js` の作成は**必須ではありません**。ワークフローで `env:` 設定があれば、直接 `process.env.NEXT_PUBLIC_API_ENDPOINT` を使用しても問題ありません。

---

### 4. **動的ページのレンダリング設定**

```javascript
// ❌ 古い（設定なし）
export default async function Page({ searchParams }) {
  // ビルド時にsearchParamsがundefinedになる可能性
}

// ✅ 新しい（動的レンダリングを明示）
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  // 常にリクエスト時にレンダリング
}
```

---

## まとめ

今回の修正により、以下が達成されました：

### 必須の修正（これがないとデプロイできない）
1. ✅ **ワークフローファイルへの `env:` 設定追加** - 環境変数の正しい受け渡し
2. ✅ **Next.js App Router（最新仕様）への完全対応** - Pages Routerから移行
3. ✅ **standalone モード設定** - Azure App Service向け最適化
4. ✅ **ワークフローの standalone 対応** - デプロイファイル構成の改善

### オプションの修正（デバッグ・保守性向上）
5. ✅ **環境変数管理の一元化** - エラーメッセージの改善
6. ✅ **fetchファイルのリファクタリング** - コードの可読性向上

**重要**: 本質的な問題は「ワークフローファイルに `env:` 設定を忘れないこと」です。これにより、安定したデプロイプロセスが確保されました。
