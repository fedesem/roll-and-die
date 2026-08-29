import type { Meta, StoryObj } from "@storybook/react";
import { Sparkles } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";

const meta: Meta = {
  title: "UI/Dialog",
  tags: ["autodocs"]
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="gold" leftIcon={<Sparkles className="h-4 w-4" />}>
            Open Spellbook
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fireball (Level 3 Evocation)</DialogTitle>
          <DialogDescription>
            A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an
            explosion of flame.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 text-sm text-slate-300">
          <p>
            <strong className="text-amber-400">Casting Time:</strong> 1 action
          </p>
          <p>
            <strong className="text-amber-400">Range:</strong> 150 feet
          </p>
          <p>
            <strong className="text-amber-400">Damage:</strong> 8d6 fire damage on failed Dexterity save.
          </p>
        </div>
        <DialogFooter>
          <Button variant="secondary">Cancel</Button>
          <Button variant="primary">Cast Spell (Slot 3)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
};
