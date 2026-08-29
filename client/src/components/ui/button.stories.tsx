import type { Meta, StoryObj } from "@storybook/react";
import { Dices, Shield, Sparkles, Sword, Trash2 } from "lucide-react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "outline", "ghost", "danger", "gold"]
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "icon"]
    },
    isLoading: { control: "boolean" },
    disabled: { control: "boolean" }
  }
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: "Roll Initiative",
    variant: "primary",
    leftIcon: <Dices className="h-4 w-4" />
  }
};

export const Gold: Story = {
  args: {
    children: "Critical Hit!",
    variant: "gold",
    leftIcon: <Sparkles className="h-4 w-4" />
  }
};

export const Secondary: Story = {
  args: {
    children: "Cast Spell",
    variant: "secondary",
    leftIcon: <Sword className="h-4 w-4" />
  }
};

export const Danger: Story = {
  args: {
    children: "Delete Campaign",
    variant: "danger",
    leftIcon: <Trash2 className="h-4 w-4" />
  }
};

export const Loading: Story = {
  args: {
    children: "Saving...",
    variant: "primary",
    isLoading: true
  }
};

export const IconButton: Story = {
  args: {
    variant: "outline",
    size: "icon",
    children: <Shield className="h-4 w-4" />,
    "aria-label": "Armor Class"
  }
};
