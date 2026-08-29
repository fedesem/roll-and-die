import type { Meta, StoryObj } from "@storybook/react";
import { Dices, Sparkles } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta: Meta = {
  title: "UI/Popover",
  tags: ["autodocs"]
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <div className="p-8">
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" leftIcon={<Dices className="h-4 w-4" />}>
              Quick Dice Roller
            </Button>
          }
        />
        <PopoverContent showCloseButton>
          <h4 className="font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Custom Roll
          </h4>
          <p className="text-xs text-slate-300 mb-3">Select dice formula or modifier to execute directly.</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {["1d4", "1d6", "1d8", "1d10", "1d12", "1d20"].map((dice) => (
              <Button key={dice} size="sm" variant="secondary">
                {dice}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="gold" className="w-full">
            Roll 2d20 (Advantage)
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
};
