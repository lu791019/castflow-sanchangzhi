/** 正文下方的一行提示：長按任何一段可以留下「這句我也是」 */
export function ResonanceHint() {
  return (
    <p className="mt-1 mb-0 flex items-center gap-2 text-caption leading-[1.7] text-ink-600">
      <span aria-hidden="true" className="block h-3 w-0.5 flex-none bg-ember" />
      長按任何一段，可以在旁邊留下「這句我也是」。
    </p>
  );
}
