import type { Metadata } from "next";
import { FormMeasure } from "@/components/app-shell/form-measure";
import { requirePageUserId } from "@/lib/auth/page";
import { listVoiceSamples } from "@/lib/voice/repository";
import { PageHeader } from "../settings-parts";
import { VoiceView } from "./voice-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我的語氣｜散場誌",
  robots: { index: false },
};

export default async function VoicePage() {
  const userId = await requirePageUserId("/me/settings/voice");
  const samples = await listVoiceSamples(userId);
  return (
    <FormMeasure>
      <PageHeader title="我的語氣" backHref="/me/settings" backLabel="返回設定" />
      <VoiceView
        pasted={samples.filter((sample) => sample.source !== "spoken")}
        spokenCount={samples.filter((sample) => sample.source === "spoken").length}
      />
    </FormMeasure>
  );
}
