import { DashboardBanner } from "@/components/dashboard/DashboardBanner";

export const BannerWidget = () => {
  return (
    <div className="h-full" role="region" aria-label="Dashboard Banner">
      <DashboardBanner />
    </div>
  );
};