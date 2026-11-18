import { FormEvent, useEffect, useRef, useState } from "react";

type Provider = "anthropic" | "openai";

type MessageMeta = {
  skill: boolean;
  provider: Provider;
  model: string;
  appliedReferences: string[];
};

type Message = {
  role: "user" | "assistant";
  content: string;
  meta?: MessageMeta;
};

const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Claude",
  openai: "GPT",
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [skill, setSkill] = useState(true);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          skill,
          provider,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `サーバーエラー (HTTP ${res.status})`);
      }
      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply as string,
        meta: {
          skill,
          provider,
          model: (data.model as string) || PROVIDER_LABEL[provider],
          appliedReferences: (data.appliedReferences as string[]) || [],
        },
      };
      setMessages([...history, assistantMessage]);
    } catch (err: any) {
      setError(err?.message || "送信に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    if (loading) return;
    setMessages([]);
    setError("");
    setInput("");
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1>nihongoチャット</h1>
          <button type="button" className="reset-button" onClick={handleReset} disabled={loading}>
            会話をリセット
          </button>
        </div>
        <p className="header-desc">
          「nihongo」スキルのON/OFFとモデルを切り替えて、返答の違いを比べる検証用チャットです。
        </p>
        <div className="controls">
          <label className="switch-row">
            <span className="switch-label">nihongoスキル</span>
            <button
              type="button"
              role="switch"
              aria-checked={skill}
              className={`switch ${skill ? "on" : "off"}`}
              onClick={() => setSkill((v) => !v)}
            >
              <span className="switch-knob" />
            </button>
            <span className={`switch-state ${skill ? "on" : "off"}`}>{skill ? "ON" : "OFF"}</span>
          </label>

          <div className="segmented" role="group" aria-label="モデル選択">
            {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`segmented-item ${provider === p ? "active" : ""}`}
                onClick={() => setProvider(p)}
              >
                {PROVIDER_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="message-list" ref={listRef}>
        {messages.length === 0 && (
          <div className="empty">
            <p>例：「明日の会議を来週にずらすメールを書いて」</p>
            <p>スキルON/OFFやモデルを切り替えて、同じ依頼で返答を比べてみてください。</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message-row ${m.role}`}>
            <div className={`bubble ${m.role}`}>
              <div className="bubble-content">{m.content}</div>
              {m.role === "assistant" && m.meta && (
                <div className="meta">
                  <span className={`meta-badge ${m.meta.skill ? "skill-on" : "skill-off"}`}>
                    スキル{m.meta.skill ? "ON" : "OFF"}
                  </span>
                  <span className="meta-badge model">{m.meta.model}</span>
                  {m.meta.skill && m.meta.appliedReferences.length > 0 && (
                    <span className="meta-refs">
                      適用: {m.meta.appliedReferences.join(", ")}
                    </span>
                  )}
                  {m.meta.skill && m.meta.appliedReferences.length === 0 && (
                    <span className="meta-refs">適用: （referencesなし）</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message-row assistant">
            <div className="bubble assistant loading">考え中…</div>
          </div>
        )}
      </main>

      {error && <div className="error">{error}</div>}

      <form className="input-form" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力（Enterで改行、送信ボタンで送信）"
          rows={2}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? "送信中…" : "送信"}
        </button>
      </form>
    </div>
  );
}
