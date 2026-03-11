import HomeClient from "@/src/app/home/HomeClient";

export default function HomePage() {
  const maxItems = Number(process.env.NEXT_PUBLIC_MAX_FEEDBACK_ITEMS || "200");
  return <HomeClient maxItems={Number.isFinite(maxItems) ? maxItems : 200} />;
}
