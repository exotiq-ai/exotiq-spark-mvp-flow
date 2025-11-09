import { CustomizableDashboard } from "@/components/dashboard/CustomizableDashboard";

interface Module {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  color: string;
  bgColor: string;
}

interface DashboardOverviewProps {
  modules: Module[];
  onModuleClick: (moduleId: string) => void;
}

export const DashboardOverview = ({ modules, onModuleClick }: DashboardOverviewProps) => {
  return <CustomizableDashboard modules={modules} onModuleClick={onModuleClick} />;
};
