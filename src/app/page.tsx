import HomeClient from "@/src/app/home/HomeClient";
import { getAppMode } from "@/src/server/env";

export default function HomePage() {
  const mode = getAppMode();
  const maxItems = Number(process.env.NEXT_PUBLIC_MAX_FEEDBACK_ITEMS || "50");
  return <HomeClient appMode={mode} maxItems={Number.isFinite(maxItems) ? maxItems : 50} />;
}
