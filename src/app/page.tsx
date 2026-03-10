import HomeClient from "@/src/app/home/HomeClient";
import { getAppMode } from "@/src/server/env";

export default function HomePage() {
  const mode = getAppMode();
  return <HomeClient appMode={mode} />;
}

