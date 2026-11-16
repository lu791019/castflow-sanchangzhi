/** 單封展開的「已刊登」大章：ember-dark 雙框 −6°；刊登時 1.35→1、280ms 回彈（motion.stamp） */

export function PublishedStamp({ published, date }: { published: boolean; date: string }) {
  return (
    <div
      aria-hidden={!published}
      className="absolute top-[18px] right-0.5 w-[84px] rounded-[4px] border-2 border-ember-dark p-[3px] transition-[transform,opacity] duration-[280ms] ease-[cubic-bezier(.3,1.6,.5,1)] motion-reduce:transition-none"
      style={{
        opacity: published ? 1 : 0,
        transform: `rotate(-6deg) scale(${published ? 1 : 1.35})`,
      }}
    >
      <div className="flex flex-col items-center gap-0.5 rounded-[2px] border border-ember-dark pt-1.5 pb-[5px]">
        <span className="pl-[0.2em] font-serif-tc text-lede font-bold tracking-[0.2em] text-ember-dark">已刊登</span>
        <span className="text-eyebrow tracking-[0.1em] text-ember-dark">{date}</span>
      </div>
    </div>
  );
}
