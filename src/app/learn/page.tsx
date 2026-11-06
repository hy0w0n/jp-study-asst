import type { Metadata } from "next";
import LearnFeatureList from "@/components/LearnFeatureList";

export const metadata: Metadata = {
  title: "학습 — SENSE",
};

export default function LearnPage() {
  return (
    <main className="px-5 pt-[calc(20px+env(safe-area-inset-top))] pb-8">
      <h1 className="text-[26px] font-bold leading-tight">학습</h1>
      <p className="mt-2 text-base text-muted">한자 다음으로 열릴 공부예요.</p>
      <section aria-label="학습 메뉴" className="mt-6">
        <LearnFeatureList />
      </section>
    </main>
  );
}
