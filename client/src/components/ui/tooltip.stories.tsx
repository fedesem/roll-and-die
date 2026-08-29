import type { Meta, StoryObj } from "@storybook/react";
import { HelpCircle, Shield, Sword } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipProvider } from "./tooltip";

const meta: Meta = {
  title: "UI/Tooltip",
  tags: ["autodocs"]
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <TooltipProvider>
      <div className="flex gap-4 p-8 items-center">
        <Tooltip content="Natural Armor AC calculation: 10 + Dex + Con">
          <Button variant="outline" size="sm" leftIcon={<Shield className="h-4 w-4" />}>
            AC 18
          </Button>
        </Tooltip>

        <Tooltip content="Advantage on attack rolls when flanking">
          <Button variant="secondary" size="sm" leftIcon={<Sword className="h-4 w-4" />}>
            Flanking
          </Button>
        </Tooltip>

        <Tooltip content="Roll 1d20 + modifier against DC">
          <button type="button" className="text-slate-400 hover:text-amber-400">
            <HelpCircle className="h-5 w-5" />
          </button>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
};
