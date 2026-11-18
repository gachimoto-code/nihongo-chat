import "dotenv/config";
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3001);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-sol";
const MAX_TOKENS = 2048;

// ---------------------------------------------------------------------------
// nihongo スキルの読み込み（backend/skill/nihongo/）
// ---------------------------------------------------------------------------
const SKILL_DIR = path.join(__dirname, "..", "skill", "nihongo");
const REFERENCES_DIR = path.join(SKILL_DIR, "references");

function readSkillFile(name: string): string {
  try {
    return fs.readFileSync(path.join(SKILL_DIR, name), "utf-8");
  } catch {
    return "";
  }
}

const SKILL_MD = readSkillFile("SKILL.md");
const ALWAYS_MD = readSkillFile("ALWAYS.md");

const referenceContents = new Map<string, string>();
try {
  for (const file of fs.readdirSync(REFERENCES_DIR)) {
    if (file.endsWith(".md")) {
      referenceContents.set(
        file,
        fs.readFileSync(path.join(REFERENCES_DIR, file), "utf-8")
      );
    }
  }
} catch {
  // references が読めなくてもサーバーは起動する
}

// 最新メッセージのキーワード → 適用する reference ファイルのマッピング
const REFERENCE_KEYWORDS: { file: string; keywords: string[] }[] = [
  { file: "business-email.md", keywords: ["メール", "ビジネス", "取引先", "お礼状", "依頼文"] },
  { file: "keigo.md", keywords: ["敬語", "尊敬語", "謙譲語", "丁寧語"] },
  { file: "translation.md", keywords: ["翻訳", "英訳", "和訳", "英語に", "日本語に"] },
  { file: "messaging.md", keywords: ["LINE", "ライン", "チャット", "メッセージ", "DM", "Slack", "スラック"] },
  { file: "conversation.md", keywords: ["会話", "相談", "雑談", "対話"] },
  { file: "slides-and-documents.md", keywords: ["スライド", "資料", "企画書", "提案書", "プレゼン"] },
  { file: "notices.md", keywords: ["お知らせ", "案内", "告知", "回覧"] },
  { file: "technical-writing.md", keywords: ["技術文書", "README", "マニュアル", "仕様書", "ドキュメント"] },
  { file: "ui-copy.md", keywords: ["UI", "ボタン", "画面文言", "ラベル", "エラーメッセージ"] },
  { file: "titles.md", keywords: ["タイトル", "見出し", "キャッチコピー"] },
  { file: "review.md", keywords: ["推敲", "添削", "校正", "直して", "リライト"] },
  { file: "speech.md", keywords: ["スピーチ", "挨拶", "祝辞", "乾杯"] },
  { file: "essays-and-promotion.md", keywords: ["エッセイ", "宣伝", "広告", "コラム", "随筆"] },
  { file: "entry-sheet.md", keywords: ["ES", "エントリーシート", "志望動機", "自己PR"] },
  { file: "orthography.md", keywords: ["表記", "送り仮名", "漢字", "ひらがな表記"] },
  { file: "media.md", keywords: ["記事", "メディア", "取材", "ニュース"] },
  { file: "personal-profile.md", keywords: ["プロフィール", "自己紹介"] },
  { file: "craft.md", keywords: ["文体", "書き方", "文章術"] },
  { file: "ai-patterns.md", keywords: ["AIっぽさ", "AIっぽい", "不自然"] },
];

function selectReferences(latestUserMessage: string): string[] {
  const selected: string[] = [];
  for (const entry of REFERENCE_KEYWORDS) {
    if (selected.length >= 3) break;
    if (!referenceContents.has(entry.file)) continue;
    if (entry.keywords.some((kw) => latestUserMessage.includes(kw))) {
      selected.push(entry.file);
    }
  }
  return selected;
}

// ---------------------------------------------------------------------------
// システムプロンプト組み立て
// ---------------------------------------------------------------------------
const BASE_SYSTEM_PROMPT =
  "あなたは親切なAIアシスタントです。ユーザーの依頼に日本語で分かりやすく答えてください。";

function buildSystemPrompt(skill: boolean, latestUserMessage: string) {
  if (!skill) {
    return { systemPrompt: BASE_SYSTEM_PROMPT, appliedReferences: [] as string[] };
  }
  const appliedReferences = selectReferences(latestUserMessage);
  const parts: string[] = [];
  if (SKILL_MD) parts.push(SKILL_MD);
  if (ALWAYS_MD) parts.push(ALWAYS_MD);
  for (const file of appliedReferences) {
    const content = referenceContents.get(file);
    if (content) {
      parts.push(`# 参照資料: ${file}\n\n${content}`);
    }
  }
  return { systemPrompt: parts.join("\n\n---\n\n"), appliedReferences };
}

// ---------------------------------------------------------------------------
// LLM 呼び出し（fetch で公式APIを直接叩く）
// ---------------------------------------------------------------------------
type ChatMessage = { role: "user" | "assistant"; content: string };

async function callAnthropic(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません（backend/.env を確認してください）");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API エラー (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const text = (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  if (!text) throw new Error("Anthropic API からテキスト応答が得られませんでした");
  return text;
}

async function callOpenAI(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY が設定されていません（backend/.env を確認してください）");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_completion_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI API エラー (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("OpenAI API からテキスト応答が得られませんでした");
  return text;
}

// ---------------------------------------------------------------------------
// ルート
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    anthropic: Boolean(ANTHROPIC_API_KEY),
    openai: Boolean(OPENAI_API_KEY),
  });
});

app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { messages, skill, provider } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages が空です" });
    }
    if (provider !== "anthropic" && provider !== "openai") {
      return res.status(400).json({ error: 'provider は "anthropic" か "openai" を指定してください' });
    }
    const history: ChatMessage[] = messages
      .filter(
        (m: any) =>
          m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
      )
      .map((m: any) => ({ role: m.role, content: m.content }));
    if (history.length === 0) {
      return res.status(400).json({ error: "有効なメッセージがありません" });
    }

    const latestUserMessage =
      [...history].reverse().find((m) => m.role === "user")?.content || "";
    const { systemPrompt, appliedReferences } = buildSystemPrompt(
      Boolean(skill),
      latestUserMessage
    );

    const reply =
      provider === "anthropic"
        ? await callAnthropic(systemPrompt, history)
        : await callOpenAI(systemPrompt, history);

    res.json({
      reply,
      appliedReferences,
      model: provider === "anthropic" ? ANTHROPIC_MODEL : OPENAI_MODEL,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "不明なエラーが発生しました" });
  }
});

app.listen(PORT, () => {
  console.log(`nihongo-chat backend listening on http://localhost:${PORT}`);
  console.log(
    `skill loaded: SKILL.md=${SKILL_MD.length} chars, ALWAYS.md=${ALWAYS_MD.length} chars, references=${referenceContents.size} files`
  );
  console.log(
    `api keys: anthropic=${Boolean(ANTHROPIC_API_KEY)}, openai=${Boolean(OPENAI_API_KEY)}`
  );
});
