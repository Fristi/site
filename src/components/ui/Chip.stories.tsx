import type { Meta, StoryObj } from "@storybook/react";
import { Chip } from "./Chip";

const meta: Meta<typeof Chip> = {
  title: "Design System/Chip",
  component: Chip,
  parameters: {
    backgrounds: { default: "void" },
  },
};

export default meta;
type Story = StoryObj<typeof Chip>;

export const Default: Story = {
  args: { children: "Scala" },
};

export const TagCloud: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-6">
      {["Scala", "Rust", "Kafka", "Flink", "PostgreSQL", "Kubernetes", "TypeScript", "React"].map(
        (tag) => (
          <Chip key={tag}>{tag}</Chip>
        )
      )}
    </div>
  ),
};
