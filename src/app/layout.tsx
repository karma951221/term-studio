import type { Metadata } from "next";
import "./globals.css";
import "./ui.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "terms-studio",
  description: "보험 약관 생성 도구",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>
        {/* 툴팁 공급자는 여기 하나 — ⓘ(InfoTip) 마다 두지 않는다 */}
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
