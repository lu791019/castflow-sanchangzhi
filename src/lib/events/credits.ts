/** 散場之前①底部的資料來源署名：多來源活動各自的名稱與網站（科工館網站內容採 CC BY-SA 4.0，另標授權） */

import type { EventSource } from "./collected";

export const EVENT_CREDIT_PREFIX = "活動資料：";

export interface EventSourceCredit {
  label: string;
  url: string;
  /** 要另外標示的授權（名稱＋授權條款連結） */
  license?: { label: string; url: string };
}

export const EVENT_SOURCE_CREDITS: Record<EventSource, EventSourceCredit> = {
  kktix: { label: "KKTIX", url: "https://kktix.com/" },
  opentix: { label: "OPENTIX 兩廳院文化生活", url: "https://www.opentix.life/" },
  accupass: { label: "Accupass 活動通", url: "https://www.accupass.com/" },
  tfam: { label: "臺北市立美術館", url: "https://www.tfam.museum/" },
  nmns: { label: "國立自然科學博物館", url: "https://www.nmns.edu.tw/" },
  nmmba: { label: "國立海洋生物博物館", url: "https://www.nmmba.gov.tw/" },
  songshan: { label: "松山文創園區", url: "https://www.songshanculturalpark.org/" },
  nstm: {
    label: "國立科學工藝博物館",
    url: "https://www.nstm.gov.tw/",
    license: { label: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hant" },
  },
  tnam: { label: "臺南市美術館", url: "https://www.tnam.museum/" },
  ntm: { label: "國立臺灣博物館", url: "https://www.ntm.gov.tw/" },
  nmh: { label: "國立歷史博物館", url: "https://www.nmh.gov.tw/" },
  cksmh: { label: "中正紀念堂", url: "https://www.cksmh.gov.tw/" },
  clab: { label: "臺灣當代文化實驗場", url: "https://clab.org.tw/" },
  moca: { label: "臺北當代藝術館", url: "https://www.mocataipei.org.tw/" },
  kdmofa: { label: "關渡美術館", url: "https://kdmofa.tnua.edu.tw/" },
};
