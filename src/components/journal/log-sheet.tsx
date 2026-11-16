"use client";

/**
 * 記一筆（設計稿「記一筆 A/B/C」）：底部滑出 sheet，三秒完成。
 * 一 作品（最近說過／記過的 + 作品選擇器）→ 二 什麼時候 → 三 在哪裡 →（選填）跟誰 → 記下了。
 * 記下後蓋日期章（P4 〇二）：內容淡出 160 → 章落下 200（碰紙輕觸）→ 停 600 → sheet 下滑 220 收起；
 * 「現在就想說」先記下再帶這筆進說一段。
 * 場外變體（P3 場外 C）：在哪裡選「音樂祭/演出」「展覽」時，一 改成名稱＋場地＋日期手寫（live-fields.tsx），並捲回第一段（UX-17）。
 * 同一部作品 2 小時內再記：server 回 409，在主鈕位置確認一次（UX-26）。
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SelectedWorkLinks } from "@/components/links/selected-work-links";
import { WorkPickerSheet } from "@/components/work-picker/work-picker-sheet";
import { logResumePath } from "@/lib/journal/log-draft";
import type { RecentLogWork } from "@/lib/journal/recent-works";
import { logSheetCopy, logSubmitLabel } from "@/lib/journal/log-copy";
import { repeatPrompt } from "@/lib/journal/repeat";
import { episodeCaption } from "@/lib/journal/work-caption";
import { createScrimDismissGuard } from "@/lib/ui/scrim-dismiss";
import { logicalDayIndex } from "@/lib/journal/time";
import { dateStamp } from "@/lib/journal/wording";
import { DEFAULT_REMINDER_TIMING, VENUE_LABELS, type Venue } from "@/lib/journal/types";
import { isPlannedAt, resolveWhen, type WhenChoice } from "@/lib/journal/when";
import type { PickerWork } from "@/lib/work-picker/types";
import { CloseIcon, MicIcon } from "./icons";
import { EMPTY_LIVE_DRAFT, isLiveVenue, LiveFields, liveLinkFields, type LiveDraft } from "./live-fields";
import { clearLogDraft, saveLogDraft } from "./log-draft-store";
import { useSheetDrag } from "./log-sheet-drag";
import { Perforation, PlaceSection, StampOverlay, WhenSection, WorkRow, workDisplayName } from "./log-sheet-parts";
import { EpisodeLine, RepeatConfirm, SheetNote, type RepeatAsk } from "./log-sheet-notes";
import type { SheetBoot } from "./sheet-boot";
import { useScrollTopOnLive } from "./use-scroll-top";

export interface LoggedEntry {
  id: string;
  workTitle: string;
  placeLabel: string;
  toast: string;
  /** 場外：toast 用「」而不是《》 */
  live?: boolean;
}

/** 開 sheet 時預填（散場之前「排進行程」）；不傳＝一般記一筆 */
export interface LogSheetPrefill {
  /** 電影／影集：作品列預選這一部 */
  work?: RecentLogWork;
  /** 在哪裡；選演出／展覽時作品欄改成場外手寫 */
  place?: Venue;
  /** 場外：名稱、場地、日期 */
  live?: LiveDraft;
  /** 什麼時候：排行程固定切到「選日期時間」；登入回來還原時沿用原本的選項 */
  when?: WhenChoice;
  /** datetime-local 預填值（台北牆上時間） */
  custom?: string;
  /** 跟誰（登入回來還原） */
  companions?: string;
  /** 訪客填到一半登入回來還原的（顯示「剛剛填的還在」） */
  restored?: boolean;
  /** 日誌過去月份「補記一筆」：切到選日期時間，但不是排行程（UX-24） */
  intent?: "backfill";
}

interface LogSheetProps {
  /** provider 預載的最近作品／提醒設定／是否訪客；null＝還在抓 */
  boot: SheetBoot | null;
  prefill?: LogSheetPrefill;
  onClose: () => void;
  onLogged: (entry: LoggedEntry) => void;
  /** sheet 開始收起（背景頁同時回到 1.0） */
  onLeaving?: () => void;
  /** sheet 內導去別頁（現在就想說、401 登入）、新頁出現後呼叫：收起 sheet，不讓它蓋在新頁上 */
  onNavigate?: () => void;
}

/** 〇二 時間線：章碰紙（淡出 160＋落下 200）→ 停 600 → 收起 220（exit） */
const STAMP_LAND_MS = 360;
const STAMP_HOLD_MS = 600;
const SHEET_LEAVE_MS = 220;
const DRAFT_FAILED = "這台瀏覽器存不了草稿（可能是私密瀏覽）。請先登入再記一筆。";

export function toRecent(work: PickerWork): RecentLogWork {
  return {
    id: work.id,
    kind: work.kind,
    title: work.title,
    podcast_show: work.podcast_show,
    episode_number: work.episode_number,
    poster_url: work.poster_url,
  };
}

/** 觸覺：只在「碰紙」那一格輕觸一次；系統不支援就算了 */
function tapHaptic(): void {
  navigator.vibrate?.(10);
}

export function LogSheet({ boot, prefill, onClose, onLogged, onLeaving, onNavigate }: LogSheetProps) {
  const router = useRouter();
  const recent = useMemo(() => boot?.recent ?? [], [boot]);
  const loading = !boot;
  const timing = boot?.timing ?? DEFAULT_REMINDER_TIMING;
  const [extra, setExtra] = useState<RecentLogWork | null>(prefill?.work ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(prefill?.work?.id ?? null);
  const [when, setWhen] = useState<WhenChoice>(prefill?.when ?? "now");
  const [custom, setCustom] = useState(prefill?.custom ?? "");
  const [place, setPlace] = useState<Venue | null>(prefill?.place ?? null);
  const [companions, setCompanions] = useState(prefill?.companions ?? "");
  const [live, setLive] = useState<LiveDraft>(prefill?.live ?? EMPTY_LIVE_DRAFT);
  const [phase, setPhase] = useState<"editing" | "saving" | "stamped">("editing");
  const [error, setError] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<RepeatAsk | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [now] = useState(() => new Date());
  const dialogRef = useRef<HTMLElement>(null);

  const works = useMemo(
    () => (extra && !recent.some((work) => work.id === extra.id) ? [extra, ...recent] : recent),
    [extra, recent],
  );
  const selected = works.find((work) => work.id === selectedId) ?? null;
  const resolved = resolveWhen(when, now, custom);
  const isLive = isLiveVenue(place);
  const liveName = live.name.trim();
  const ready = Boolean((isLive ? liveName : selected) && place && resolved.at) && phase === "editing";
  const subjectTitle = isLive ? liveName : selected ? workDisplayName(selected) : "";
  /** 選了未來時間＝排行程：記成計畫中，當天早上提醒 */
  const planned = Boolean(resolved.at && isPlannedAt(resolved.at, now));
  /** 從「排進行程」／補記打開、仍在選日期時間：主鈕先請人選日期（UX-11） */
  const pickingTime = prefill?.when === "custom" && when === "custom";
  /** 排行程（不是補記）且還沒選好時間：說明先講當天早上；選好了就照實際時間（過去日不講排行程） */
  const planMode = pickingTime && prefill?.intent !== "backfill";
  const copy = logSheetCopy(timing, planned, planMode && !resolved.at, boot?.guest ?? false);
  const scrollRef = useScrollTopOnLive(isLive);
  const caption = !isLive && selected ? episodeCaption(selected) : null;

  // 改了作品、時間、地點就不再問「要再記一筆嗎」
  const editing = <T,>(set: (value: T) => void) => (value: T) => {
    setRepeat(null);
    set(value);
  };

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  /** 收起：原路往下退 220ms，再交給外層卸載 */
  const leave = (then: () => void) => {
    if (leaving) return;
    setLeaving(true);
    onLeaving?.();
    setTimeout(then, SHEET_LEAVE_MS);
  };
  const dismiss = () => leave(onClose);
  // 觸控開啟時補發的 click 會落在遮罩上：只認在遮罩上按下的那次（scrim-dismiss.ts）
  const scrimGuard = useRef(createScrimDismissGuard()).current;
  const drag = useSheetDrag({ enabled: phase === "editing" && !leaving && !pickerOpen, onDismiss: dismiss });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pickerOpen && phase === "editing") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** 第一次送出請 server 查 2 小時內有沒有記過同一部；確認過就不查（UX-26） */
  const requestBody = (at: Date, venue: Venue, confirmRepeat: boolean) => {
    const base = { experiencedAt: at.toISOString(), venue, companions: companions.trim() || null, checkRepeat: !confirmRepeat };
    if (isLive) {
      return { ...base, workTitle: liveName, liveName, liveVenue: live.venue.trim() || null, liveDates: live.dates.trim() || null, ...liveLinkFields(venue, live) };
    }
    return { ...base, workId: selected?.id };
  };

  // 換頁完成（新頁已渲染）才收起：載入期間 sheet 仍在，不會露出一頁沒反應的原頁
  const pathname = usePathname();
  const openedAt = useRef(pathname);
  useEffect(() => {
    if (pathname !== openedAt.current) onNavigate?.();
  }, [onNavigate, pathname]);
  const navigate = (path: string) => router.push(path);

  const save = async (then: RepeatAsk["then"], confirmRepeat = false): Promise<string | null> => {
    if (!ready || !place || !resolved.at) return null;
    setPhase("saving");
    setError(null);
    setRepeat(null);
    const response = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(resolved.at, place, confirmRepeat)),
    }).catch(() => null);
    if (response?.status === 401) {
      // 訪客：先把填過的存起來，登入回來（/journal/new?resume=1）還原（UX-03）
      const stored = saveLogDraft({ work: isLive ? null : selected, when, custom, place, companions, live });
      if (stored) {
        navigate(logResumePath());
      } else {
        setError(DRAFT_FAILED);
        setPhase("editing");
      }
      return null;
    }
    if (response?.status === 409) {
      const body = (await response.json().catch(() => null)) as { repeat?: { loggedAt?: string } } | null;
      const loggedAt = new Date(body?.repeat?.loggedAt ?? Date.now());
      setRepeat({ prompt: repeatPrompt({ title: subjectTitle, live: isLive, loggedAt, now: new Date() }), then });
      setPhase("editing");
      return null;
    }
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "沒記成功，網路好像不太穩，再按一次。");
      setPhase("editing");
      return null;
    }
    const { entry } = (await response.json()) as { entry: { id: string } };
    clearLogDraft();
    return entry.id;
  };

  const submit = async (confirmRepeat = false) => {
    if (!ready || !place || !resolved.at) return;
    const id = await save("submit", confirmRepeat);
    if (!id) return;
    setPhase("stamped");
    const logged: LoggedEntry = {
      id,
      workTitle: subjectTitle,
      placeLabel: VENUE_LABELS[place],
      toast: copy.toast,
      live: isLive,
    };
    setTimeout(tapHaptic, STAMP_LAND_MS);
    setTimeout(() => leave(() => onLogged(logged)), STAMP_LAND_MS + STAMP_HOLD_MS);
  };

  const sayNow = async (confirmRepeat = false) => {
    if (!ready) {
      navigate("/say");
      return;
    }
    const id = await save("say", confirmRepeat);
    if (id) navigate(`/say?journal=${encodeURIComponent(id)}`);
  };

  const pickFromPicker = (work: PickerWork) => {
    const converted = toRecent(work);
    setRepeat(null);
    setExtra(converted);
    setSelectedId(converted.id);
    setPickerOpen(false);
  };

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-50 bg-scrim ${leaving ? "p4-fade-out" : "animate-scrim-in"}`}
        onPointerDown={() => scrimGuard.markPressStart()}
        onClick={() => {
          if (scrimGuard.shouldDismiss() && phase === "editing") dismiss();
        }}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="記一筆"
        tabIndex={-1}
        data-dragging={drag.dragging ? "true" : undefined}
        style={drag.offset ? { translate: `0 ${drag.offset}px` } : undefined}
        className={`fixed inset-x-0 top-12 bottom-0 z-50 mx-auto flex w-full max-w-[480px] flex-col ${leaving ? "p4-sheet-dismiss" : "animate-sheet-up"} ${drag.dragging ? "" : "p4-sheet-settle"} overflow-hidden rounded-t-control bg-paper text-ink-900 outline-none`}
      >
        {/* 把手＋標題列：往下拖跟手，超過 120px 放開收起（log-sheet-drag.ts） */}
        <div data-sheet-handle className="cursor-grab touch-none select-none active:cursor-grabbing" {...drag.handlers}>
          <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-9 rounded-[2px] bg-ink-300" />
          <div className="flex items-center justify-between pt-1 pr-2 pl-4">
            <h1 className="m-0 font-serif-tc text-section font-bold text-ink-950">記一筆</h1>
            <button type="button" onClick={dismiss} aria-label="關閉" className="flex size-11 items-center justify-center text-ink-700">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${phase === "stamped" ? "p4-fade-out" : ""}`}>
            {isLive ? (
              <LiveFields place={place} draft={live} onChange={editing(setLive)} />
            ) : (
              <WorkRow
                works={works}
                selectedId={selectedId}
                loading={loading}
                onPick={(work) => editing(setSelectedId)(work.id)}
                onSearch={() => setPickerOpen(true)}
              />
            )}
            {/* 在哪看／這一集：先留一行高度，資料回來時不把下面推下去（UX-17） */}
            {!isLive && selected ? (
              <div data-testid="log-work-extra" className="min-h-11">
                {caption ? <EpisodeLine caption={caption} /> : <SelectedWorkLinks workId={selected.id} workKind={selected.kind} />}
              </div>
            ) : null}
            <Perforation />
            <WhenSection
              choice={when}
              resolved={resolved}
              custom={custom}
              onChoose={editing(setWhen)}
              onCustom={editing(setCustom)}
            />
            <PlaceSection place={place} onPick={editing(setPlace)} />
            <label className="mx-4 mt-3 flex min-h-11 items-center gap-2.5 border-b border-ink-200">
              <span className="flex-none text-caption text-ink-600">
                跟誰<span className="text-ink-400">（選填）</span>
              </span>
              <input
                value={companions}
                onChange={(event) => setCompanions(event.target.value)}
                maxLength={200}
                placeholder="一個人、和姊姊……"
                className="min-w-0 flex-1 bg-transparent font-serif-tc text-lede text-ink-950 outline-none placeholder:text-ink-400"
              />
            </label>
          </div>

          <div data-tour="log-actions" className={`flex flex-col px-4 pt-2.5 pb-4 ${phase === "stamped" ? "p4-fade-out" : ""}`}>
            <SheetNote error={error} restored={Boolean(prefill?.restored) && phase === "editing"} />
            {repeat ? (
              <RepeatConfirm
                prompt={repeat.prompt}
                onConfirm={() => (repeat.then === "say" ? sayNow(true) : submit(true))}
                onCancel={dismiss}
              />
            ) : null}
            <button
              type="button"
              data-tour="log-submit"
              hidden={Boolean(repeat)}
              onClick={() => submit()}
              aria-disabled={!ready}
              className={`h-[52px] rounded-control text-lede font-bold tracking-[0.2em] transition-colors duration-[120ms] ${
                phase === "stamped"
                  ? "bg-ember-deep text-paper"
                  : ready || phase !== "editing"
                    ? "bg-action-primary text-paper"
                    : "bg-action-disabled-bg text-action-disabled-fg"
              }`}
            >
              {logSubmitLabel({
                isLive,
                hasSubject: Boolean(isLive ? liveName : selected),
                hasPlace: Boolean(place),
                hasTime: Boolean(resolved.at),
                planned,
                planMode: pickingTime,
              })}
            </button>
            <button
              type="button"
              data-tour="log-say-now"
              hidden={Boolean(repeat)}
              onClick={() => sayNow()}
              className="flex min-h-11 items-center justify-center gap-1.5 text-note text-ink-700"
            >
              <MicIcon />
              現在就想說
            </button>
            <p className="m-0 text-center text-eyebrow leading-relaxed text-ink-600">{copy.hint}</p>
          </div>

          {phase === "stamped" && subjectTitle && place && resolved.at ? (
            <StampOverlay
              dateLine={dateStamp(resolved.at)}
              caption={`${isLive ? `「${subjectTitle}」` : `《${subjectTitle}》`}・${VENUE_LABELS[place]}`}
              seed={logicalDayIndex(resolved.at)}
              kind={planned ? "計畫" : isLive ? "場外" : "日誌"}
            />
          ) : null}
        </div>
      </section>
      <WorkPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={pickFromPicker} />
    </>
  );
}
