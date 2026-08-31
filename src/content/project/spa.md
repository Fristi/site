---
pubDate: "2023-02-03"
banner: "/img/projects/spa/banner.png"
title: "DHL service points"
description: "Multiple (web) apps to facilitate first and last mile solutions at servicepoints"
tech:
  - "scala"
  - "java"
  - "zio"
  - "typelevel"
  - "kafka"
  - "postgresql"
  - "postman"
  - "azure"
  - "cloudflare"
  - "elastic"
  - "github"
  - "grafana"
  - "storybook"
  - "cypress"
  - "zod"
  - "jira"
  - "typescript"
  - "react"
  - "keycloak"
  - "docker"
brochure:
  - icon: "outline/inbox"
    title: "One locker platform for multiple vendors"
    image: "/img/projects/spa/courier-hand-out.png"
    description: "DHL Benelux has been using lockers for some time, but they have encountered issues with the white-labeled software provided by the vendors. In late 2022, they began developing a new platform that encompasses all vendors, from communication with the hardware to the user interface on the lockers."
  - icon: "outline/scale"
    title: "Hardware abstraction layer"
    image: "/img/projects/spa/customer-hand-in.png"
    description: "For communicating with the hardware we creating a hardware abstraction layer in the form of a REST API. This runs locally on the machines and per vendor, it will talk a different protocol. For the REST API we used Scala, http4s, fs2, tapir and scodec. The REST API is the same OpenAPI contract and therefore the frontend does not need any change per vendor."
  - icon: "outline/scale"
    title: "User interface is just React"
    image: "/img/projects/spa/ui.png"
    description: "The user interface is a single-page web application which is written in TypeScript/React. It communicates locally with the Hardware Abstraction Layer. There is another API that is highly secured to check if someone is allowed to open a door to retrieve or bring a parcel."
---

Worked as part of the team that is responsible for the software being used at service points. This includes a hand-held scanner, lockers and self-scan. These are first and last-mile solutions, such that the customer can hand in and hand out parcels.

The biggest undertaking was to work with the lockers. We've built our locker platform, from controlling the hardware ourselves to inventory management of lockers and parcels with telemetry and authentication.
