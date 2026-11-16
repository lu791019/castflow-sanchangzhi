/**
 * 10/15 四項小改（polish5）：
 * - 寬螢幕（≥1024）日誌、我的、索引的容器對齊刊頭（1360：刊頭的「散場誌」左緣＝內容左緣、「說一段」右緣＝內容右緣）；375 不變
 * - 文章正文段落之間有段距（以前每段各包一層 div，`last:mb-0` 套到每一段）：375、1440 都量
 * - 寬螢幕長文限欄高（Dex 選 B）：每組欄最多約 80vh，排滿往下接下一組；引言不跨欄、小標不落在組底；375 單欄不分組
 * （演出小標籤在 375 換行見 livefilter.spec。）
 * 文章自己種（fixtures/uxread-seed.ts），不讀既有資料。POLISH5_SHOTS=1 時輸出 375／1440 截圖到 test-results/polish5/。
 */

import type { Locator, Page } from "@playwright/test";
import { rest } from "./fixtures/admin";
import { loginAsNewUser } from "./fixtures/auth";
import { patch } from "./fixtures/p2-seed";
import { expect, test } from "./fixtures/test";
import { createArticle, createAuthor, createWorkWithSlug } from "./fixtures/uxread-seed";

const SHOTS = process.env.POLISH5_SHOTS === "1";
const RUN = Date.now().toString(36).slice(-5);
const MOBILE = { width: 375, height: 812 };
const WIDE = { width: 1440, height: 900 };
/** 每組欄最多幾個螢幕高（同 components/wide/column-groups.tsx） */
const MAX_GROUP_VIEWPORT = 0.8;
/** 欄平衡的顆粒：最多多出一行字＋段距 */
const BALANCE_SLACK_PX = 48;

const PARAGRAPHS = [
  "燈亮的時候我沒有馬上站起來，看著片尾名單一行一行往上走，想把剛剛那兩個小時再放一次。",
  "三位導演各拍一位賊王，剪在一起卻毫無縫隙。觀影過程中完全不會有銜接不順暢和突兀的情況，整部片的劇情就在三位新生代導演的催生下，讓三位大賊踏上各自的命運征途。",
  "本片改編真實的香港三大賊王，轟動一時並銷聲匿跡。以綁架富豪之子為樂的那一位，由江湖謠言而興起了新的念頭，決定集合他們三位來創下新的犯罪巔峰。",
  "戲院外面在下雨，騎樓下擠滿等雨停的人，大家都在滑手機，只有一個老先生抬頭看著對街的招牌，好像在等什麼人。",
  "我想起第一次自己一個人去看電影，是高中聯考完的那個暑假，買了一張下午的票，散場時天還是亮的，覺得自己長大了一點。",
  "片裡有一場戲是三個人坐在茶餐廳裡，誰也不說話，只聽得到湯匙碰到杯子的聲音，那幾秒鐘比任何槍戰都緊張。",
];

/** 正文夠長（約 3 組欄）才看得到限欄高；中間有小標與清單 */
const BODY = [
  ...PARAGRAPHS,
  "## 小人物",
  ...PARAGRAPHS.map((text) => `${text}後來回想，這一段其實是整部片的心臟。`),
  "- 茶餐廳那場戲\n- 片尾名單\n- 騎樓下的老先生",
  ...PARAGRAPHS.map((text) => `再看一次：${text}`),
  "或許人們只是歷史齒輪轉動下的小人物，但小人物也有自己的選擇，這部片把這件事拍得很誠實。",
].join("\n\n");

test.use({ hasTouch: true });

async function seedLongArticle(accounts: { newEmail: (tag: string) => string; trackWork: (id: string) => void }): Promise<string> {
  const work = await createWorkWithSlug({ kind: "movie", title: `段距測試片${RUN}` });
  accounts.trackWork(work.id);
  const author = await createAuthor(accounts.newEmail("author"), `段距作者${RUN}`);
  const title = `看完段距測試片${RUN}`;
  const slug = await createArticle(author, { title, workId: work.id });
  if (!slug) throw new Error("[polish5] 文章沒有 share slug");
  const [episode] = await rest<{ id: string }>("episodes", `select=id&share_slug=eq.${slug}`);
  await patch("contents", `episode_id=eq.${episode.id}`, { body: `# ${title}\n\n${BODY}` });
  return slug;
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/polish5/${name}.png`, fullPage: true });
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  height: number;
  width: number;
}

async function boxesOf(locator: Locator): Promise<Box[]> {
  return locator.evaluateAll((nodes) =>
    nodes.map((node) => {
      const { left, right, top, bottom, height, width } = node.getBoundingClientRect();
      return { left, right, top, bottom, height, width };
    }),
  );
}

/** 正文段落（不含引言裡的那一段） */
function paragraphs(page: Page): Locator {
  return page.locator("article p:not(aside p)");
}

/** 同一欄裡上下相鄰的段落：下一段頂端到上一段底端的距離 */
function verticalGaps(boxes: readonly Box[]): number[] {
  return boxes.slice(1).flatMap((box, index) => {
    const previous = boxes[index];
    return Math.abs(box.left - previous.left) < 2 && box.top > previous.top ? [box.top - previous.bottom] : [];
  });
}

/** 刊頭內容的左右緣（「散場誌」左緣、「說一段」右緣）＝頁面內容的左右緣 */
async function expectAlignedWithMasthead(page: Page, heading: Locator): Promise<void> {
  const masthead = page.getByRole("banner").filter({ has: page.getByRole("link", { name: "說一段" }) });
  const logo = await masthead.getByRole("link", { name: "散場誌", exact: true }).boundingBox();
  const say = await masthead.getByRole("link", { name: "說一段" }).boundingBox();
  if (!logo || !say) throw new Error("[polish5] 量不到刊頭");
  const frame = await page.locator(".p4-under-sheet").evaluate((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return { left: rect.left + Number.parseFloat(style.paddingLeft), right: rect.right - Number.parseFloat(style.paddingRight) };
  });
  // 頁面自帶左右 16（手機版距）：外框內緣＋16＝內容緣
  expect(Math.round(frame.left + 16)).toBe(Math.round(logo.x));
  expect(Math.round(frame.right - 16)).toBe(Math.round(say.x + say.width));
  const box = await heading.boundingBox();
  expect(Math.round(box?.x ?? -1)).toBe(Math.round(logo.x));
}

test("文章正文：375 與 1440 段落之間有段距；1440 長文每組欄最多約 80vh、往下接", async ({ page, accounts }) => {
  const slug = await seedLongArticle(accounts);

  await test.step("375：段距約 1.2em、不分組也沒有欄", async () => {
    await page.setViewportSize(MOBILE);
    await page.goto(`/s/${slug}`);
    await expect(paragraphs(page).first()).toBeVisible({ timeout: 20_000 });
    const gaps = verticalGaps(await boxesOf(paragraphs(page)));
    expect(gaps.length).toBeGreaterThan(10);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(16);
    const groups = page.locator("article [data-column-group]");
    await expect(groups).toHaveCount(1);
    expect(await groups.first().evaluate((node) => getComputedStyle(node).columnWidth)).toBe("auto");
    await shot(page, "article-375");
  });

  await test.step("1440：分成多組欄、每組不超過 80vh、欄寬 340；段距照樣在；引言不跨欄；小標不在組底", async () => {
    await page.setViewportSize(WIDE);
    await page.goto(`/s/${slug}`);
    await expect(paragraphs(page).first()).toBeVisible({ timeout: 20_000 });
    const groups = page.locator("article [data-column-group]");
    await expect.poll(() => groups.count()).toBeGreaterThanOrEqual(2);
    const limit = WIDE.height * MAX_GROUP_VIEWPORT + BALANCE_SLACK_PX;
    for (const box of await boxesOf(groups)) expect(box.height).toBeLessThanOrEqual(limit);
    for (const width of await groups.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).columnWidth))) expect(width).toBe("340px");
    // 組與組上下接：下一組在上一組下面
    const boxes = await boxesOf(groups);
    boxes.slice(1).forEach((box, index) => expect(box.top).toBeGreaterThanOrEqual(boxes[index].bottom));

    const gaps = verticalGaps(await boxesOf(paragraphs(page)));
    expect(gaps.length).toBeGreaterThan(5);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(16);

    // 引言不跨欄：寬度不超過實際一欄（column-width 340 是下限，實際欄寬依容器平分）
    const column = await groups.first().evaluate((node) => {
      const style = getComputedStyle(node);
      const width = node.clientWidth;
      const gap = Number.parseFloat(style.columnGap);
      const count = Math.max(1, Math.floor((width + gap) / (Number.parseFloat(style.columnWidth) + gap)));
      return { count, single: (width - (count - 1) * gap) / count };
    });
    expect(column.count).toBeGreaterThanOrEqual(2);
    const quote = await page.locator("article aside").first().boundingBox();
    expect(quote?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(column.single + 1);
    const lastIsHeading = await groups.evaluateAll((nodes) =>
      nodes.slice(0, -1).some((node) => node.lastElementChild?.firstElementChild?.tagName === "H2" && node.lastElementChild.childElementCount === 1),
    );
    expect(lastIsHeading).toBe(false);
    await shot(page, "article-1440");
  });
});

test("寬螢幕 1360 容器：日誌、我的、索引對齊刊頭；375 不變", async ({ page, accounts }) => {
  const email = accounts.newEmail("frame");
  await loginAsNewUser(page, email, "/journal");

  const pages = [
    { name: "journal", path: "/journal", heading: () => page.getByRole("main").getByRole("heading").first() },
    { name: "me", path: "/me", heading: () => page.getByRole("main").getByRole("heading", { level: 1 }) },
    { name: "index", path: "/catalog", heading: () => page.getByRole("main").getByRole("heading", { level: 1 }) },
  ];

  for (const target of pages) {
    await test.step(`${target.name} 1440：內容左右緣對齊刊頭`, async () => {
      await page.setViewportSize(WIDE);
      await page.goto(target.path);
      await expect(target.heading()).toBeVisible({ timeout: 20_000 });
      await expectAlignedWithMasthead(page, target.heading());
      await shot(page, `frame-${target.name}-1440`);
    });

    await test.step(`${target.name} 375：外框照手機`, async () => {
      await page.setViewportSize(MOBILE);
      await page.goto(target.path);
      await expect(target.heading()).toBeVisible({ timeout: 20_000 });
      const frame = await page.locator(".p4-under-sheet").boundingBox();
      expect(Math.round(frame?.width ?? 0)).toBe(MOBILE.width);
      const box = await target.heading().boundingBox();
      expect(Math.round(box?.x ?? -1)).toBe(16);
      await shot(page, `frame-${target.name}-375`);
    });
  }
});
