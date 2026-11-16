import { FallbackImg } from "@/components/ui/fallback-img";
import type { DeskThumb as Thumb } from "@/lib/me/desk";

const PLATE = "relative box-border flex border-t-2 border-b border-ink-950 bg-paper-2";

function Hatch() {
  return (
    <span
      aria-hidden="true"
      className="block h-[72px] w-12 bg-[repeating-linear-gradient(135deg,var(--color-ink-50)_0_5px,var(--color-paper-2)_5px_10px)]"
    />
  );
}

/** desk.thumb：48×72；podcast 48×48 下移 12 對齊；字卡直排 12 */
export function DeskThumb({ thumb }: { thumb: Thumb }) {
  switch (thumb.kind) {
    case "poster":
      // 海報載入失敗退回斜線底（同沒海報的樣子）
      return <FallbackImg src={thumb.url} className="block h-[72px] w-12 object-cover" fallback={<Hatch />} />;
    case "plate":
      return (
        <span aria-hidden="true" className={`${PLATE} h-[72px] w-12 justify-center overflow-hidden pt-1.5`}>
          <span className="font-serif-tc text-caption font-bold tracking-[0.08em] text-ink-950 [writing-mode:vertical-rl]">
            {thumb.text}
          </span>
        </span>
      );
    case "pod":
      return (
        <span aria-hidden="true" className={`${PLATE} mt-3 h-12 w-12 justify-start overflow-hidden pt-[3px] pl-1`}>
          <span className="font-serif-tc text-eyebrow leading-[1.15] font-bold text-ink-950">{thumb.text}</span>
          {thumb.no ? (
            <span className="absolute right-1 bottom-[3px] font-serif-tc text-caption font-bold text-ember-dark tabular-nums">
              {thumb.no}
            </span>
          ) : null}
        </span>
      );
    case "hatch":
      return <Hatch />;
  }
}
