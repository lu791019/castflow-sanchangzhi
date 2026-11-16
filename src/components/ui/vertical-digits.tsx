import { verticalDigitRuns } from "@/lib/format/digits";

/**
 * 直排文字裡的阿拉伯數字：1–2 位併成一格橫寫（10 月 9 日），3 位以上逐字直立（第 0142 號）。
 * 放在 writing-mode: vertical-rl 的容器內使用；字距沿用外層。
 */
export function VerticalDigits({ text }: { text: string }) {
  return (
    <>
      {verticalDigitRuns(text).map((run, index) => {
        if (run.kind === "text") return run.text;
        return (
          <span
            key={index}
            className={
              run.kind === "combine"
                ? "tracking-normal [text-combine-upright:all]"
                : "[text-orientation:upright]"
            }
          >
            {run.text}
          </span>
        );
      })}
    </>
  );
}
