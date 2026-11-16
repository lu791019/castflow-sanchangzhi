import { ImageResponse } from "next/og";
import { getServerNotify } from "@/lib/alerts/notify";
import { fetchImageDataUri, loadOgCard } from "@/lib/share/og-data";
import { loadCardFonts, loadNeutralFonts, type OgFont } from "@/lib/share/og-fonts";
import { ogModelText, type OgCardModel } from "@/lib/share/og-model";
import { OgCard } from "./og-card";
import { OgNeutralCard } from "./og-neutral";
import { OG_HEIGHT, OG_WIDTH } from "./tokens";

/** 內容卡短快取：作者收回後，社群平台重抓就拿到中性卡 */
const CARD_CACHE = "public, max-age=300, s-maxage=300";
const NEUTRAL_CACHE = "public, max-age=60, s-maxage=60";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 先在 server 畫完：ImageResponse 是串流，畫壞了才發現就來不及改出中性卡 */
async function renderPng(element: React.ReactElement, fonts: OgFont[], cacheControl: string): Promise<Response> {
  const image = new ImageResponse(element, { width: OG_WIDTH, height: OG_HEIGHT, fonts });
  const body = await image.arrayBuffer();
  return new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": cacheControl } });
}

export async function renderNeutralOg(): Promise<Response> {
  return renderPng(<OgNeutralCard />, await loadNeutralFonts(), NEUTRAL_CACHE);
}

async function loadImage(model: OgCardModel, slug: string): Promise<string | null> {
  if (!model.imageUrl) return null;
  try {
    return await fetchImageDataUri(model.imageUrl);
  } catch (error) {
    await getServerNotify()(
      "warn",
      "OG 卡海報／封面抓不到，改畫直排字卡",
      `slug=${slug} ${errorMessage(error)}`,
    );
    return null;
  }
}

/** 分享頁 OG 卡：私人／收回／找不到回中性卡；字型或繪製失敗也回中性卡並推警報 */
export async function renderShareOg(slug: string): Promise<Response> {
  const notify = getServerNotify();
  let model: OgCardModel | null;
  try {
    model = await loadOgCard(slug);
  } catch (error) {
    await notify("error", "OG 卡讀資料失敗，改出中性卡", `slug=${slug} ${errorMessage(error)}`);
    return renderNeutralOg();
  }
  if (!model) return renderNeutralOg();

  const image = await loadImage(model, slug);
  try {
    const fonts = await loadCardFonts(ogModelText(model));
    return await renderPng(<OgCard model={model} image={image} />, fonts, CARD_CACHE);
  } catch (error) {
    await notify("error", "OG 卡字型或繪製失敗，改出中性卡", `slug=${slug} ${errorMessage(error)}`);
    return renderNeutralOg();
  }
}
