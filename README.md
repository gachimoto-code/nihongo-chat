# nihongoチャット

「nihongo」スキル（AIが書いた日本語を自然な日本語に直すエージェントスキル）の効果を、実際の会話で比べるための検証用チャットアプリです。

- **スキルのON/OFF**を切り替えて、同じ依頼に対する返答の違いを比べられます
- **モデル（Claude / GPT）**も画面上で切り替えられます
- 各返答の下に、使用した設定（スキルON/OFF・モデル名）と、スキルON時に適用された参照資料（references）のファイル名が表示されます

## 構成

```
nihongo-chat/
├── frontend/   Vite + React + TypeScript（チャット画面、開発サーバーは 5173）
└── backend/    Express + TypeScript（API、デフォルト 3001）
    └── skill/nihongo/   同梱した nihongo スキル本体
```

スキルONのとき、バックエンドは `backend/skill/nihongo/SKILL.md` と `ALWAYS.md` を全文システムプロンプトに読み込み、さらにユーザーの最新メッセージの内容に合う参照資料（`references/`）を最大3件まで選んで連結します。スキルOFFのときは素の汎用アシスタント用システムプロンプトで応答します。

## セットアップ

前提: Node.js 20 以上。

### 1. バックエンドの .env を作る

```bash
cd backend
cp .env.example .env
```

`.env` を開いて、使用するLLMのAPIキーを実キーに書き換えてください（使う方だけでも動作します）。

| 変数 | 内容 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic の APIキー（Claude用） |
| `OPENAI_API_KEY` | OpenAI の APIキー（GPT用） |
| `ANTHROPIC_MODEL` | Claude のモデル名（デフォルト: `claude-sonnet-5`） |
| `OPENAI_MODEL` | GPT のモデル名（デフォルト: `gpt-5.6-sol`） |
| `PORT` | バックエンドのポート（デフォルト: `3001`） |

`.env` は絶対にコミットしないでください（`.gitignore` で除外済みです）。

### 2. 依存パッケージのインストール

```bash
cd backend && npm install
cd ../frontend && npm install
```

## 起動方法

ターミナルを2つ使います。

```bash
# ターミナル1: バックエンド
cd backend
npm run dev        # 開発モード（tsx watch）
# または
npm run build && npm start   # ビルドしてから起動
```

```bash
# ターミナル2: フロントエンド
cd frontend
npm run dev
```

ブラウザで http://localhost:5173 を開いてください。開発サーバーが `/api` をバックエンド（3001）へプロキシします。

起動確認用に、バックエンドの `GET /api/health` でAPIキーの設定有無を確認できます。

## 使い方

- **nihongoスキル トグル**: ONにすると nihongo スキルの指示（SKILL.md + ALWAYS.md + 場面に応じた参照資料）をシステムプロンプトに読み込んで応答します。OFFは素のモデル応答です。会話の途中でも切り替えられます。
- **モデル選択（Claude / GPT）**: セグメントボタンで使用するLLMを切り替えます。こちらも会話の途中から変更できます。
- **返答下の表示**: 各返答に「スキルON/OFF」「モデル名」、スキルON時は適用された参照資料のファイル名（例: `business-email.md`）が表示されます。同じ依頼文を条件だけ変えて送ると、文面の違いをそのまま比べられます。
- **会話をリセット**: ヘッダーのボタンで会話履歴を消去します。

## スキルの出典とライセンス

同梱している nihongo スキルは AnIT012 氏の作品です。

- リポジトリ: https://github.com/AnIT012/nihongo
- ライセンス: MIT License（`backend/skill/nihongo/LICENSE` に同梱）
- Copyright (c) 2026 AnIT012

本アプリ自体のコードは、この検証プロジェクト用に作成したものです。
