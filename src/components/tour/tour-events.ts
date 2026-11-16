/** 重看導覽：ⓘ 與「我的」頁卡片發事件，由 TourHost（知道登入者是誰）接手 */

export const TOUR_REPLAY_EVENT = "castflow:tour-replay";

export function requestTourReplay(): void {
  window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));
}
