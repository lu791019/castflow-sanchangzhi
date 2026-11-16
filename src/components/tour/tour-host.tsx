"use client";

/**
 * 新手導覽掛載點（社交殼 layout 與文章頁各一個）：網址變了就請 runner 續播／自動開始／收起；
 * 收到重看導覽事件就從第一步開始（不在起點頁先換過去）。
 */

import "driver.js/dist/driver.css";
import "./tour.css";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { tourKey } from "@/lib/tour/storage";
import { createTourRunner, type TourRunner } from "./tour-runner";
import { TOUR_REPLAY_EVENT } from "./tour-events";

export function TourHost({ userId }: { userId: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const runnerRef = useRef<TourRunner | null>(null);
  const pathRef = useRef(pathname);

  useEffect(() => {
    const flow = userId ? "member" : "guest";
    const runner = createTourRunner({
      flow,
      key: tourKey(flow, userId),
      storage: window.localStorage,
      navigate: (path) => router.push(path),
    });
    runnerRef.current = runner;
    runner.sync(pathRef.current);
    const onReplay = () => {
      const goTo = runner.replay(pathRef.current);
      if (goTo) router.push(goTo);
    };
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
    return () => {
      window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
      runner.destroy();
      runnerRef.current = null;
    };
  }, [userId, router]);

  useEffect(() => {
    pathRef.current = pathname;
    runnerRef.current?.sync(pathname);
  }, [pathname]);

  return null;
}
