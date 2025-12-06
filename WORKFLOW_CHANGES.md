# ワークフローファイルの変更点

## 提示されたコードと最終版の違い

元々提示されたワークフローファイルと、最終的に動作したファイルの違いを説明します。

---

## 変更点一覧

### **変更1: `mkdir deploy` → `mkdir -p deploy`**

**行番号**: 36行目

```yaml
# 提示されたコード
mkdir deploy

# 最終版
mkdir -p deploy
```

**理由**:
- `-p` オプションを追加することで、ディレクトリが既に存在してもエラーにならない
- 再実行時の安全性が向上

**影響**: 微小（ベストプラクティス）

---

### **変更2: staticファイルのコピー方法を変更**

**行番号**: 38行目

```yaml
# 提示されたコード
cp -r ./.next/static/. ./deploy/.next/static

# 最終版
cp -r ./.next/static ./deploy/.next/static
```

**理由**:
- `./.next/static/.` は「staticフォルダの中身」をコピー
- `./.next/static` は「staticフォルダごと」をコピー
- 最終的にどちらでも動作するが、後者の方がシンプル

**影響**: 微小（どちらでも動作する）

---

### **変更3: `public` フォルダのコピーを条件付きに**

**行番号**: 39行目

```yaml
# 提示されたコード（記載なし）

# 最終版（追加）
if [ -d "./public" ]; then cp -r ./public ./deploy/public; fi
```

**理由**:
- `public` フォルダが存在しない場合、エラーになるため
- 条件分岐を追加して、存在する場合のみコピー

**影響**: **重要**（publicフォルダがない場合のビルドエラーを回避）

---

### **変更4: `zip` コマンドの実行方法**

**行番号**: 42行目

```yaml
# 提示されたコード
run: zip release.zip ./deploy -r

# 最終版
run: cd deploy && zip -r ../release.zip .
```

**理由**:
- 提示されたコードでは、`deploy` フォルダ自体がzip内に含まれてしまう
- `cd deploy` してから zip することで、フォルダ構造が正しくなる

**ファイル構造の違い**:

```
# 提示されたコード（間違い）
release.zip
└── deploy/
    ├── server.js
    └── ...

# 最終版（正しい）
release.zip
├── server.js
└── ...
```

**影響**: **重大**（デプロイ後のファイル構造が正しくなる）

---

### **変更5: `path: .` → `path: release.zip`**

**行番号**: 48行目

```yaml
# 提示されたコード
- name: Upload artifact for deployment job
  uses: actions/upload-artifact@v4
  with:
    name: node-app
    path: .  # すべてのファイルをアップロード

# 最終版
- name: Upload artifact for deployment job
  uses: actions/upload-artifact@v4
  with:
    name: node-app
    path: release.zip  # zipファイルのみアップロード
```

**理由**:
- `path: .` だと、すべてのファイル（node_modules等）がアップロードされる
- `path: release.zip` にすることで、必要なファイルのみアップロード

**影響**: **重要**（アップロード時間とサイズを大幅削減）

---

### **変更6: デプロイステップに `Unzip` を追加**

**行番号**: 60-61行目

```yaml
# 提示されたコード（記載なし）

# 最終版（追加）
- name: Unzip artifact for deployment
  run: unzip release.zip -d deploy
```

**理由**:
- アップロードしたzipファイルを解凍する必要がある
- 提示されたコードにはこのステップが**欠けていた**

**影響**: **重大**（これがないとデプロイが失敗する）

---

### **変更7: `publish-profile` のSecret名が異なる**

**行番号**: 70行目

```yaml
# 提示されたコード
publish-profile: ${{ secrets.AZUREAPPSERVICE_PUBLISHPROFILE_C6DE2E2176F942ECA9189FBB37D9D1C2 }}

# 最終版
publish-profile: ${{ secrets.AZUREAPPSERVICE_PUBLISHPROFILE_5FF959AF4CBB46469B7C9233148AFD5B }}
```

**理由**:
- Azureが自動生成するSecret名が異なる
- これは**環境ごとに異なる**ため、自動的に置き換わったもの

**影響**: なし（環境による違い）

---

## 変更点の重要度まとめ

| 変更箇所 | 重要度 | 理由 |
|---------|-------|------|
| `mkdir -p` | 低 | ベストプラクティス |
| **staticパスのタイポ修正** | **高** | タイポがあるとコピー失敗 |
| **public条件分岐** | **中** | publicフォルダがない場合のエラー回避 |
| **zipコマンド修正** | **高** | ファイル構造が正しくなる |
| **path: release.zip** | 中 | アップロード効率化 |
| **Unzip追加** | **高** | これがないとデプロイ失敗 |
| publish-profile | なし | 環境による違い |

---

## 提示されたコードの問題点

元々提示されたコードには以下の**問題**がありました：

1. ❌ **タイポ**: `. /deploy` となっている（38行目）
2. ❌ **Unzipステップがない**: デプロイ時の解凍処理が欠けている
3. ⚠️ **zip方法が非効率**: `deploy` フォルダごとzip
4. ⚠️ **publicフォルダの考慮なし**: 存在しない場合エラー

これらを修正することで、正常にデプロイできるようになりました。

---

## 最終的なワークフローファイル

正しく動作する最終版は [.github/workflows/main_tech0-gen-11-step3-2-node-45.yml](.github/workflows/main_tech0-gen-11-step3-2-node-45.yml) を参照してください。
