// Browser-side client for a locally-running Ollama daemon.
// No backend / no secrets — talks directly to http://localhost:11434.

const URL_KEY = "ollamaUrl";
const MODEL_KEY = "ollamaModel";
const DEFAULT_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.1:8b";
const NVIDIA_KEY = "nvidiaKey";

export function getNvidiaKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NVIDIA_KEY) || "";
}
export function setNvidiaKey(k: string) {
  if (typeof window !== "undefined") localStorage.setItem(NVIDIA_KEY, k);
}

export function getOllamaUrl(): string {
  if (typeof window === "undefined") return DEFAULT_URL;
  return localStorage.getItem(URL_KEY) || DEFAULT_URL;
}
export function setOllamaUrl(url: string) {
  if (typeof window !== "undefined") localStorage.setItem(URL_KEY, url);
}
export function getOllamaModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL;
}
export function setOllamaModel(m: string) {
  if (typeof window !== "undefined") localStorage.setItem(MODEL_KEY, m);
}

export async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${getOllamaUrl()}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models ?? []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

export async function pingOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${getOllamaUrl()}/api/tags`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ChatArgs {
  system?: string;
  prompt: string;
  model?: string;
  json?: boolean;
  signal?: AbortSignal;
}

export async function chat({ system, prompt, model, json, signal }: ChatArgs): Promise<string> {
  const body = {
    model: model || getOllamaModel(),
    stream: false,
    format: json ? "json" : undefined,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ],
  };
  const res = await fetch(`${getOllamaUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message?.content ?? "";
}

export async function chatJson<T>(args: ChatArgs): Promise<T> {
  const raw = await chat({ ...args, json: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Try to salvage a JSON object/array embedded in the response.
    const match = raw.match(/[{\[][\s\S]*[}\]]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Model did not return valid JSON");
  }
}
