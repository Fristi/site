import type { Meta, StoryObj } from "@storybook/react";
import { Display, Headline, Title, BodyText, Caption } from "./Typography";

const meta: Meta = {
  title: "Design System/Typography",
  parameters: {
    backgrounds: { default: "void" },
  },
};

export default meta;

export const AllLevels: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 p-8 max-w-2xl">
      <Display>The Luminescent Curator</Display>
      <Headline>Crafting high-end digital experiences</Headline>
      <Title>Backend Architecture</Title>
      <BodyText>
        Designing and building high-throughput data pipelines using Scala, Kafka,
        and Flink. Emphasis on correctness, type safety, and operational simplicity.
      </BodyText>
      <Caption>Last updated · April 2026</Caption>
    </div>
  ),
};

export const DisplayStory: StoryObj = {
  name: "Display",
  render: () => (
    <div className="p-8">
      <Display>The Luminescent Curator</Display>
    </div>
  ),
};

export const HeadlineStory: StoryObj = {
  name: "Headline",
  render: () => (
    <div className="p-8">
      <Headline>Crafting high-end digital experiences</Headline>
    </div>
  ),
};

export const BodyStory: StoryObj = {
  name: "Body",
  render: () => (
    <div className="p-8 max-w-lg">
      <BodyText>
        Designing and building high-throughput data pipelines using Scala, Kafka,
        and Flink. Emphasis on correctness, type safety, and operational simplicity.
      </BodyText>
    </div>
  ),
};
