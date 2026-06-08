import { useEffect, useState } from "react";
import { Cpu, RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  getOllamaModel, getOllamaUrl, listModels, pingOllama,
  setOllamaModel, setOllamaUrl, getNvidiaKey, setNvidiaKey,
} from "@/lib/ollama";

export function OllamaStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [url, setUrl] = useState(getOllamaUrl());
  const [model, setModel] = useState(getOllamaModel());
  const [nvidiaKey, setNvidiaKeyLocal] = useState(getNvidiaKey());
  const [models, setModels] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  async function refresh() {
    setChecking(true);
    const ok = await pingOllama();
    setOnline(ok);
    if (ok) setModels(await listModels());
    setChecking(false);
  }

  useEffect(() => { refresh(); }, []);

  function save() {
    setOllamaUrl(url);
    setOllamaModel(model);
    setNvidiaKey(nvidiaKey);
    refresh();
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="px-2.5 py-1.5 text-xs rounded-md inline-flex items-center gap-1.5 border border-border/60 hover:bg-secondary/50"
          title="Local Ollama settings"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              online === null ? "bg-muted-foreground" : online ? "bg-[oklch(0.72_0.17_150)]" : "bg-destructive"
            }`}
          />
          <Cpu className="h-3.5 w-3.5" />
          <span className="hidden lg:inline font-mono">{online ? model : "Offline"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold">Local Ollama</div>
            <p className="text-xs text-muted-foreground">
              Runs on your machine. Start with{" "}
              <code className="font-mono">ollama serve</code> then pull a model, e.g.{" "}
              <code className="font-mono">ollama pull llama3.1:8b</code>.
            </p>
          </div>
          <div>
            <Label className="text-xs">Base URL</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)} className="mt-1 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Model</Label>
            <Input
              value={model}
              onChange={e => setModel(e.target.value)}
              list="ollama-models"
              className="mt-1 h-8 text-xs font-mono"
            />
            <datalist id="ollama-models">
              {models.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>
          <div>
            <Label className="text-xs">Nvidia NIM API Key (Optional Override)</Label>
            <Input type="password" value={nvidiaKey} onChange={e => setNvidiaKeyLocal(e.target.value)} className="mt-1 h-8 text-xs" placeholder="nvapi-..." />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} className="flex-1">Save</Button>
            <Button size="sm" variant="outline" onClick={refresh} disabled={checking}>
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Status:{" "}
            {online === null ? "checking…"
              : online ? <span className="text-[oklch(0.72_0.17_150)]">connected</span>
              : <span className="text-destructive">unreachable — falling back to mock data</span>}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
