"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StyleDimensions, REQUIRED_DIMENSION_KEYS, DIMENSION_LABELS } from "@/lib/types";
import type { OwnedStyle } from "@/lib/auth/owned-reads";
import { updateStyleDimensionsAction, deleteStyleAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { Loader2, Save, Check, Trash2, Plus } from "lucide-react";

interface StyleEditorProps {
  style: OwnedStyle;
}

/** 風格 DNA 編輯 UI；資料由 server page 依擁有者讀好傳入，瀏覽器不直連 DB */
export function StyleEditor({ style }: StyleEditorProps) {
  const router = useRouter();
  const { id: styleId, name, platform, exampleCount } = style;
  const [dimensions, setDimensions] = useState<StyleDimensions | null>(style.dimensions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [newCustomName, setNewCustomName] = useState("");

  async function handleSave() {
    if (!dimensions) return;
    setSaving(true);
    setError("");
    const result = await updateStyleDimensionsAction(styleId, dimensions);
    setSaving(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addCustomDimension() {
    const trimmed = newCustomName.trim();
    if (!trimmed || !dimensions) return;
    setDimensions({ ...dimensions, [trimmed]: "" });
    setNewCustomName("");
  }

  function removeCustomDimension(key: string) {
    if (!dimensions) return;
    const rest = Object.fromEntries(Object.entries(dimensions).filter(([k]) => k !== key));
    setDimensions(rest as StyleDimensions);
  }

  async function handleDelete() {
    if (!confirm("確定要刪除此風格 DNA？")) return;
    const result = await deleteStyleAction(styleId);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    router.push("/styles");
  }

  if (!dimensions) {
    return <p className="text-muted-foreground">找不到此風格。</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CastFlow · 風格"
        title={name}
        description={`${platform} · ${exampleCount} 篇範例`}
        actions={
          <>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : saved ? (
                <Check className="mr-1 h-3 w-3" />
              ) : (
                <Save className="mr-1 h-3 w-3" />
              )}
              {saved ? "已儲存" : "儲存"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-1 h-3 w-3" />
              刪除
            </Button>
          </>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-4">
        <h2 className="text-eyebrow font-bold tracking-[0.2em] text-ink-600">
          必填維度
        </h2>
        {REQUIRED_DIMENSION_KEYS.map((key) => (
          <div key={key} className="rounded-lg border p-4">
            <label className="block text-sm font-semibold mb-2">
              {DIMENSION_LABELS[key]}
            </label>
            <textarea
              value={dimensions[key]}
              onChange={(e) =>
                setDimensions((prev) =>
                  prev ? { ...prev, [key]: e.target.value } : prev,
                )
              }
              className="min-h-[80px] w-full resize-y rounded-lg border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}

        {(() => {
          const requiredSet = new Set<string>(REQUIRED_DIMENSION_KEYS);
          const customKeys = Object.keys(dimensions).filter(
            (key) => !requiredSet.has(key),
          );
          if (customKeys.length === 0 && !newCustomName) return null;
          return (
            <>
              <h2 className="text-eyebrow font-bold tracking-[0.2em] text-ink-600 pt-2">
                自訂維度
              </h2>
              {customKeys.map((key) => (
                <div key={key} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold">{key}</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomDimension(key)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <textarea
                    value={dimensions[key]}
                    onChange={(e) =>
                      setDimensions((prev) =>
                        prev ? { ...prev, [key]: e.target.value } : prev,
                      )
                    }
                    className="min-h-[80px] w-full resize-y rounded-lg border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
            </>
          );
        })()}

        <div className="flex items-center gap-2 pt-2">
          <Input
            value={newCustomName}
            onChange={(e) => setNewCustomName(e.target.value)}
            placeholder="新增自訂維度名稱"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomDimension();
              }
            }}
          />
          <Button variant="outline" size="sm" onClick={addCustomDimension}>
            <Plus className="mr-1 h-3 w-3" />
            新增
          </Button>
        </div>
      </div>
    </div>
  );
}
