/** 同一個 request 內共用一次 getUser（社交殼的導航、導覽都要知道是否登入；server only） */

import { cache } from "react";
import { getCurrentUserId } from "./session";

export const requestUserId = cache(getCurrentUserId);
