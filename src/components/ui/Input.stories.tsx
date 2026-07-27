import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Design System/Input",
  component: Input,
  parameters: {
    backgrounds: { default: "void" },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { label: "Your name", placeholder: "Mark de Jong" },
};

export const NoLabel: Story = {
  args: { placeholder: "Enter your email" },
};

export const Disabled: Story = {
  args: { label: "Email", placeholder: "you@example.com", disabled: true },
};

export const Form: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-sm p-8">
      <Input label="Full name" placeholder="Mark de Jong" />
      <Input label="Email address" placeholder="mail@markdejong.org" type="email" />
      <Input label="Company" placeholder="Acme Inc." />
    </div>
  ),
};
