import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueLineChart } from "@/components/charts/RevenueLineChart";
import { TrendingUp } from "lucide-react";

export const RevenueWidget = () => {
  return (
    <Card className="h-full" role="region" aria-label="Revenue Analytics Widget">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
          <span>Revenue Analytics</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RevenueLineChart />
      </CardContent>
    </Card>
  );
};