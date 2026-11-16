/**
 * 換頁骨架（UX-08）：紙色底、墨色髮絲線排出版面輪廓，像還沒上墨的校樣——不用灰色閃爍方塊。
 * 刊頭「散場誌」是真字，一眼就知道換頁了；整塊等 200ms 才淡入（.page-skeleton），降低動態時直接顯示。
 * server component，不帶 client JS。
 */

type Variant = "article" | "feature" | "journal" | "before";

const ARTICLE_BODY = ["100%", "96%", "100%", "88%", "100%", "92%", "64%"];
const FEATURE_BODY = ["100%", "94%", "100%", "72%"];

/** 一行字的位置：細線；strong＝標題，墨色稍深、線稍粗 */
function Rule({ width, strong = false, ember = false }: { width: string; strong?: boolean; ember?: boolean }) {
  const tone = ember ? "h-px bg-ember-tint-2" : strong ? "h-[2px] bg-ink-300" : "h-px bg-ink-200";
  return <span className={`block flex-none ${tone}`} style={{ width }} />;
}

function Lines({ widths, gap = "gap-[22px]" }: { widths: string[]; gap?: string }) {
  return (
    <span className={`flex flex-col ${gap}`}>
      {widths.map((width, index) => (
        <Rule key={index} width={width} />
      ))}
    </span>
  );
}

/** 字卡外框：上緣 2px 墨線、其餘髮絲線，跟無海報字卡同一個語彙 */
function Plate({ className }: { className: string }) {
  return <span className={`box-border block flex-none border border-t-2 border-ink-200 border-t-ink-950 bg-paper-2 ${className}`} />;
}

function Masthead({ height = "h-[52px]", right }: { height?: string; right?: string }) {
  return (
    <div className={`mx-4 flex items-center justify-between border-b border-ink-950 ${height}`}>
      <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">散場誌</span>
      {right ? <span className="text-eyebrow tracking-[0.14em] text-ink-600">{right}</span> : <Rule width="56px" />}
    </div>
  );
}

function ArticleSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[680px]">
      <Masthead height="h-12" />
      <div className="flex flex-col gap-5 px-4 pt-7">
        <Rule width="88px" ember />
        <span className="flex flex-col gap-4">
          <Rule width="86%" strong />
          <Rule width="58%" strong />
        </span>
        <Rule width="40%" />
        <span className="mt-4 flex items-end gap-3.5">
          <span className="flex flex-1 flex-col gap-3">
            <Rule width="36px" ember />
            <Rule width="70%" strong />
            <Rule width="54%" />
          </span>
          <Plate className="h-[294px] w-[196px] -mr-4" />
        </span>
        <span className="mt-6">
          <Lines widths={ARTICLE_BODY} />
        </span>
      </div>
    </div>
  );
}

function FeatureSkeleton() {
  return (
    <>
      <Masthead right="作品特輯" />
      <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-x-4 pt-7 pl-4">
        <span className="flex justify-end gap-3 pt-1">
          <span className="block h-[150px] w-px bg-ember-tint-2" />
          <span className="block h-[180px] w-[2px] bg-ink-300" />
        </span>
        <Plate className="h-[330px] w-[220px]" />
      </div>
      <div className="flex flex-col gap-6 px-4 pt-6">
        <Rule width="72%" />
        <span className="grid grid-cols-3 border-y border-ink-200 py-4">
          {[0, 1, 2].map((cell) => (
            <span key={cell} className="flex flex-col gap-3 border-ink-200 px-3 first:pl-0 [&:not(:first-child)]:border-l">
              <Rule width="32px" />
              <Rule width="64%" strong />
            </span>
          ))}
        </span>
        <Lines widths={FEATURE_BODY} />
      </div>
    </>
  );
}

function JournalSkeleton() {
  return (
    <>
      <Masthead />
      <div className="flex flex-col gap-3 px-4 pt-4">
        <span className="flex items-center gap-2.5">
          <span className="block size-6 flex-none rounded-[2px] border border-ink-200" />
          <Rule width="96px" strong />
        </span>
        <span className="flex h-11 items-center gap-[26px] border-b border-ink-200">
          <Rule width="32px" strong />
          <Rule width="32px" />
        </span>
        <span className="flex flex-col gap-3 pt-3">
          <Rule width="44%" strong />
          <Rule width="62%" />
        </span>
        <span className="mt-3 grid grid-cols-7 border-t border-l border-ink-200">
          {Array.from({ length: 35 }, (_, cell) => (
            <span key={cell} className="block h-[52px] border-r border-b border-ink-200" />
          ))}
        </span>
      </div>
    </>
  );
}

function BeforeSkeleton() {
  return (
    <>
      <Masthead />
      <div className="flex flex-col gap-4 px-4 pt-[22px]">
        <Rule width="140px" ember />
        <span className="flex flex-col gap-4">
          <Rule width="44%" strong />
          <Rule width="72%" strong />
        </span>
        <span className="mt-3 grid grid-cols-2 gap-3">
          {[0, 1].map((card) => (
            <span key={card} className="flex flex-col gap-3 rounded-control border border-ink-200 p-3">
              <Plate className="aspect-[2/3] w-full" />
              <Rule width="80%" strong />
              <Rule width="56%" />
            </span>
          ))}
        </span>
      </div>
    </>
  );
}

const VARIANTS: Record<Variant, () => React.ReactElement> = {
  article: ArticleSkeleton,
  feature: FeatureSkeleton,
  journal: JournalSkeleton,
  before: BeforeSkeleton,
};

export function PageSkeleton({ variant }: { variant: Variant }) {
  const Body = VARIANTS[variant];
  return (
    <div role="status" aria-live="polite" data-testid="page-skeleton" className="page-skeleton pb-[120px]">
      <span className="sr-only">載入中…</span>
      <div aria-hidden="true">
        <Body />
      </div>
    </div>
  );
}
