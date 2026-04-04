import type { Meta, StoryObj } from "@storybook/react";
import { GlassCard } from "./GlassCard";

const meta: Meta<typeof GlassCard> = {
  title: "Design System/GlassCard",
  component: GlassCard,
  parameters: {
    backgrounds: { default: "void" },
  },
  argTypes: {
    glow: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof GlassCard>;

export const Default: Story = {
  args: {
    title: "Scala & Functional Systems",
    glow: false,
    children:
      "Designing and building high-throughput data pipelines using Scala, Kafka, and Flink. Emphasis on correctness, type safety, and operational simplicity.",
  },
};

export const WithGlow: Story = {
  args: {
    title: "Backend Architecture",
    glow: true,
    children:
      "End-to-end backend design: from domain modelling to production observability. Built for teams that ship fast and sleep soundly.",
  },
};

export const NoTitle: Story = {
  args: {
    children:
      "A flexible card surface for any content. The glass effect works without a title header.",
  },
};

export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 p-8 bg-void min-h-screen">
      <GlassCard title="Stream Processing">
        Real-time event processing at scale using Apache Kafka and Flink.
      </GlassCard>
      <GlassCard title="Backend Engineering" glow>
        Robust APIs and microservices built with functional programming principles.
      </GlassCard>
      <GlassCard title="Legacy Modernisation">
        Incremental migration strategies that keep the business running while you
        rebuild.
      </GlassCard>
      <GlassCard title="Technical Audit">
        In-depth code and architecture review with a prioritised remediation plan.
      </GlassCard>
    </div>
  ),
};
