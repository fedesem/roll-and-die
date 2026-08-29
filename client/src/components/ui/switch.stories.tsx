import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch";

const meta: Meta<typeof Switch> = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  args: {
    defaultChecked: false
  }
};

export const WithLabel: Story = {
  args: {
    label: "Dynamic Lighting",
    description: "Enable line of sight rendering and token vision boundaries.",
    defaultChecked: true
  }
};

export const Disabled: Story = {
  args: {
    label: "DM Fog of War Override",
    description: "Only the Dungeon Master can reveal concealed sectors.",
    disabled: true,
    defaultChecked: false
  }
};
