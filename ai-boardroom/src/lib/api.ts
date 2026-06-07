export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function streamBoardroom(payload: object, onChunk: (data: string) => void) {
  const res = await fetch(`${API_BASE}/boardroom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value));
  }
}