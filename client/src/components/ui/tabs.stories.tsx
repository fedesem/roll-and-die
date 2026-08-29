import type { Meta, StoryObj } from "@storybook/react";
import { Shield, Sparkles, User } from "lucide-react";
import { Tab, TabPanel, Tabs, TabsList } from "./tabs";

const meta: Meta = {
  title: "UI/Tabs",
  tags: ["autodocs"]
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <div className="p-6 max-w-lg">
      <Tabs defaultValue="character">
        <TabsList className="grid w-full grid-cols-3">
          <Tab value="character" className="flex items-center gap-1.5">
            <User className="h-4 w-4" /> Character
          </Tab>
          <Tab value="spells" className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Spells
          </Tab>
          <Tab value="inventory" className="flex items-center gap-1.5">
            <Shield className="h-4 w-4" /> Equipment
          </Tab>
        </TabsList>
        <TabPanel value="character" className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
          <h3 className="font-semibold text-amber-400 mb-1">Gimli Ironbreaker</h3>
          <p className="text-sm text-slate-400">Level 5 Mountain Dwarf Barbarian (Path of the Berserker)</p>
        </TabPanel>
        <TabPanel value="spells" className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
          <p className="text-sm text-slate-400">Barbarians cannot cast spells while raging, but innate racial traits apply.</p>
        </TabPanel>
        <TabPanel value="inventory" className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
          <ul className="text-sm text-slate-300 list-disc list-inside space-y-1">
            <li>Greataxe (+1 Enchanted)</li>
            <li>Handaxes (x2)</li>
            <li>Explorer's Pack</li>
          </ul>
        </TabPanel>
      </Tabs>
    </div>
  )
};
