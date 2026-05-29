import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { MarginFilterBar, useMarginActiveFilterCount } from "./MarginFilterBar";
import { useMarginFilters } from "./MarginFiltersContext";

export function MarginMobileFilterSheet() {
  const count = useMarginActiveFilterCount();
  const f = useMarginFilters();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 text-xs text-muted-foreground tabular-nums truncate">
        {format(f.start, "MMM d")} – {format(f.end, "MMM d, yyyy")}
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            Filters
            {count > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">{count}</Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filter Margin</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <MarginFilterBar vertical />
          </div>
          <SheetFooter>
            <SheetClose asChild>
              <Button className="w-full h-11">Apply</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
