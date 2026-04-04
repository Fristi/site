import type { Meta, StoryObj } from "@storybook/react";
import { BackgroundBlob, BlobBackground } from "./BackgroundBlob";
import { Display, BodyText } from "./Typography";
import { Button } from "./Button";

const meta: Meta<typeof BackgroundBlob> = {
  title: "Design System/BackgroundBlob",
  component: BackgroundBlob,
  parameters: {
    backgrounds: { default: "void" },
  },
  argTypes: {
    color: { control: "radio", options: ["primary", "secondary"] },
    position: {
      control: "select",
      options: ["top-left", "top-right", "bottom-left", "bottom-right", "center"],
    },
    size: { control: "radio", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof BackgroundBlob>;

export const Default: Story = {
  args: { color: "primary", position: "top-right", size: "md" },
  render: (args) => (
    <div className="relative w-full h-64 bg-void overflow-hidden rounded-2xl">
      <BackgroundBlob {...args} />
    </div>
  ),
};

export const HeroSection: StoryObj = {
  render: () => (
    <BlobBackground>
      <div className="bg-void min-h-screen px-8 py-24 flex flex-col gap-6 max-w-2xl">
        <Display>Crafting systems that scale</Display>
        <BodyText>
          I help engineering teams design and build high-throughput backends, data
          pipelines, and functional systems — with Scala, Rust, and Kafka at the core.
        </BodyText>
        <div className="flex gap-4 mt-4">
          <Button variant="primary">Start a project</Button>
          <Button variant="glass">View work</Button>
        </div>
      </div>
    </BlobBackground>
  ),
};
