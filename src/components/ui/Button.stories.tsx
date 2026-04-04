import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Design System/Button",
  component: Button,
  parameters: {
    backgrounds: { default: "void" },
  },
  argTypes: {
    variant: { control: "radio", options: ["primary", "glass"] },
    size: { control: "radio", options: ["sm", "md", "lg"] },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: "primary", size: "md", children: "Get in touch" },
};

export const Glass: Story = {
  args: { variant: "glass", size: "md", children: "Learn more" },
};

export const Small: Story = {
  args: { variant: "primary", size: "sm", children: "Tag action" },
};

export const Large: Story = {
  args: { variant: "primary", size: "lg", children: "Start a project" },
};

export const Disabled: Story = {
  args: { variant: "primary", size: "md", children: "Unavailable", disabled: true },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="primary" size="sm">Small primary</Button>
      <Button variant="primary" size="md">Medium primary</Button>
      <Button variant="primary" size="lg">Large primary</Button>
      <Button variant="glass" size="sm">Small glass</Button>
      <Button variant="glass" size="md">Medium glass</Button>
      <Button variant="glass" size="lg">Large glass</Button>
    </div>
  ),
};
