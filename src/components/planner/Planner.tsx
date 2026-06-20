"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlannerClient } from "./PlannerClient";
import { CreateBlockDialog } from "./CreateBlockDialog";
import type { TimeBlock } from "@/types/database";

interface PlannerProps {
  blocks: TimeBlock[];
  date: string;
}

export function Planner({ blocks, date }: PlannerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultHour, setDefaultHour] = useState<number | undefined>();

  function openCreate(hour?: number) {
    setDefaultHour(hour);
    setDialogOpen(true);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Day Planner</h2>
            <p className="text-xs text-muted-foreground">
              {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "short", day: "numeric",
              })}
              {" · drag to reschedule · mark hit/partial/missed"}
            </p>
          </div>
          <Button
            onClick={() => openCreate()}
            className="gap-2 bg-cadence-accent hover:bg-cadence-accent/90 text-white rounded-xl h-9 text-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Block
          </Button>
        </div>

        <PlannerClient
          blocks={blocks}
          date={date}
          onCreateClick={openCreate}
        />
      </div>

      <CreateBlockDialog
        open={dialogOpen}
        defaultHour={defaultHour}
        date={date}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
