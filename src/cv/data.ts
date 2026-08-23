import type { Cv } from "./types";

/**
 * Single source of truth for the about page, PDF, and DOCX.
 * Edit this file, then run `npm run export-cv` (also runs on build).
 */
export const cv: Cv = {
  name: "Mark de Jong",
  role: "Software Engineer",
  email: "mail@markdejong.org",
  website: "https://markdejong.org",
  websiteLabel: "markdejong.org",
  github: "https://github.com/Fristi",
  githubLabel: "github.com/Fristi",
  linkedin: "https://www.linkedin.com/in/mark-de-jong-a808b7167",
  downloads: {
    pdf: "/cv/mark-de-jong.pdf",
    docx: "/cv/mark-de-jong.docx",
  },
  introduction: [
    "I'm a software engineer with 13+ years of experience, but what's driven my career more than any technology is a genuine appetite for learning new domains, new paradigms, new ways of thinking about hard problems.",
    "That curiosity has taken me across industries (energy, logistics, finance, healthcare, education) and across the full stack — from distributed systems and large-scale billing pipelines to embedded firmware on microcontrollers, custom CMS platforms, and mobile apps.",
    "Along the way I've gone deep into functional programming, domain-driven design, event sourcing, and AI agents. I care about craft at every level: the elegance of a type system, the clarity of an API contract, the feel of a well-designed interface.",
  ],
  experience: [
    {
      role: "Software Engineer",
      company: "Vectos",
      period: "Jul 2018 – now",
      logo: "/img/companies/vectos.png",
      summary: "Software consulting in Scala, Kotlin and Rust.",
      bullets: [
        {
          lead: "Vandebron",
          text: "Green energy marketplace. Automated billing for 100+ assets across 5 contract types. Contributed to a Virtual Power Plant steering hundreds of MW of wind and solar. Helped to migrate Akka → Pekko migration of 100+ microservices.",
        },
        {
          lead: "DHL",
          text: "International courier. Backend development of My DHL Workplace for ~5,000 couriers. Helped with a parcel locker platform from hardware to software, now running 3,000+ lockers. Also helped with a self-billing solution for service points processing 2M+ records per run.",
        },
        {
          lead: "",
          text: "Built AI agents on existing back-office services (Kotlin, Spring Boot, Spring AI, Axon) to automate operational work. Helped to migrate Bitbucket → GitHub migration, GitHub Actions CI/CD, a Sonatype artifact platform, and GitOps with ArgoCD.",
        },
      ],
      skills: [
        "Scala",
        "Kotlin",
        "Java",
        "ZIO",
        "Spring Boot",
        "Spring AI",
        "Axon",
        "TypeScript",
        "React",
        "PostgreSQL",
        "Kafka",
        "Kubernetes",
        "ArgoCD",
        "Event Sourcing",
        "Hexagonal Architecture",
      ],
    },
    {
      role: "Software Engineer",
      company: "Lunatech",
      period: "Dec 2016 – Jun 2018",
      logo: "/img/companies/lunatech.png",
      summary: "Software consulting in Scala.",
      bullets: [
        {
          lead: "VEON Ltd.",
          text: "Helped with backend development in the Digital Financial Services team, supporting thousands of daily top-up transactions by optimizing and rewriting distributed transaction processing software for improved performance and reliability. Mentored engineers to maintain high-quality delivery.",
        },
        {
          lead: "ING Group",
          text: "Bootstrapped the Approval Workflow API platform for peer-reviewing high-risk transactions with complex signing and authorization schemes, applying functional programming and distributed system principles to improve scalability, security, and system robustness.",
        },
      ],
      skills: [
        "Scala",
        "Functional Programming",
        "Cats",
        "Play",
        "Akka",
        "PostgreSQL",
        "Docker",
      ],
    },
    {
      role: "Software Engineer",
      company: "ZorgDomein Nederland B.V.",
      period: "Nov 2015 – Apr 2016",
      logo: "",
      summary: "Healthcare referral platform for care providers in the Netherlands.",
      bullets: [
        {
          lead: "",
          text: "Extension of existing software.",
        },
      ],
      skills: [
        "Scala",
        "Functional Programming",
        "Cats",
        "Akka",
        "PostgreSQL",
        "Docker",
      ],
    },
    {
      role: "Software Engineer",
      company: "Q42",
      period: "Mar 2014 – Nov 2015",
      logo: "/img/companies/q42.svg",
      summary: "Web agency working across languages like C#, Swift and Scala.",
      bullets: [
        {
          lead: "Malmberg",
          text: "Developed a custom CMS from scratch for digital school boards, interactive lessons, and games, supporting millions of students. Delivered incremental improvements biweekly; system live since 2014.",
        },
        {
          lead: "PostNL",
          text: "Contributed to the iOS app team, introducing Swift and R.swift for type-safe resources, adding new user flows, and implementing CI with Bitrise to streamline builds, testing, and releases.",
        },
      ],
      skills: [
        "Scala",
        "Functional Programming",
        "Play",
        "MongoDB",
        "Angular",
        "JavaScript",
        "Swift",
        "C#",
        "ASP.NET MVC",
        "Elasticsearch",
      ],
    },
    {
      role: "Software Engineer",
      company: "Mirabeau",
      period: "May 2012 – Feb 2014",
      logo: "",
      summary: "Digital agency — web platforms, DDD, and continuous delivery.",
      bullets: [
        {
          lead: "",
          text: "Performed web/software development and releases, delivered a unit testing workshop, and promoted DDD and event-sourcing practices while setting up CI pipelines using Bamboo and TeamCity.",
        },
        {
          lead: "Theodoor Gilissen Bankiers",
          text: "Helped develop a greenfield private banking platform, serving ~7,000 high-net-worth customers with secure authentication via Active Directory and OpenAM.",
        },
        {
          lead: "SkillsKompas",
          text: "Helped develop the competence-domain career guidance platform, modelling functions, tasks, and education paths using complex data structures and recommendation logic.",
        },
      ],
      skills: [
        "C#",
        "Java",
        "Hibernate",
        "Spring",
        "Google Web Toolkit",
        "OpenAM",
      ],
    },
    {
      role: "Software Engineer",
      company: "Ambrero Software B.V.",
      period: "Mar 2011 – Apr 2012",
      logo: "",
      summary: "Custom software and websites.",
      bullets: [
        {
          lead: "",
          text: "Development of complex software/websites and documentation of the software in UML.",
        },
      ],
      skills: ["PHP", "Java", "jQuery"],
    },
  ],
  talks: [
    {
      date: "2023",
      name: "ZIO test vs Scalatest",
      description: "A talk comparing zio-test vs scalatest",
      url: "https://fristi.github.io/zio-test-presentation/",
    },
    {
      date: "2023",
      name: "refined",
      description:
        "During amsterdam.scala meetup I gave an introduction talk to refinement types in Scala",
      url: "https://fristi.github.io/refined-deck",
    },
    {
      date: "2023",
      name: "Rust introduction",
      description: "Gave a Rust introduction talk at Flock.community",
      url: "https://fristi.github.io/rust-introduction",
    },
    {
      date: "2022",
      name: "Bazel",
      description:
        "At amsterdam.scala I gave an introduction talk about Bazel and Scala",
      url: "https://fristi.github.io/bazel-deck",
    },
    {
      date: "2020",
      name: "cats",
      description:
        "A talk about the functional programming library cats in Scala",
      url: "https://fristi.github.io/cats-deck",
    },
    {
      date: "2018",
      name: "http4s",
      description:
        "At functional rotterdam meetup I gave a talk about http4s, a functional http server/client library written in Scala",
      url: "https://fristi.github.io/http4s-deck",
    },
  ],
  projects: [
    {
      date: "2018",
      name: "mirra",
      description:
        "Small utility library to perform model based property based testing on tagless final algebras in Scala",
      url: "https://github.com/Fristi/mirra",
    },
    {
      date: "2018",
      name: "volatile-saga",
      description:
        "Small proof of concept of a Monad which includes lazy compensating actions. This means, when a computation fails it will attempt to roll it back",
      url: "https://github.com/Fristi/volatile-saga",
    },
    {
      date: "2018",
      name: "itinere",
      description:
        "A eDSL (embedded domain specific language) in Scala to describe HTTP endpoints. From these declarations you can implement a server/client or generate OpenAPI docs",
      url: "https://github.com/Fristi/itinere",
    },
    {
      date: "2017",
      name: "flumina",
      description:
        "A native Kafka driver written from the ground up, so encoding/decoding messages from and to the Kafka broker, multiplexing, etc",
      url: "https://github.com/Fristi/flumina",
    },
    {
      date: "2017",
      name: "formulation",
      description:
        "A eDSL (embedded domain specific language) in Scala to map data structures to Avro encoders, decoders and schemas",
      url: "https://github.com/Fristi/formulation",
    },
  ],
  technologies: [
    {
      icon: "scala",
      name: "Scala",
      mastery: 90,
      description: "tapir, caliban, sttp, akka/pekko",
    },
    {
      icon: "typelevel",
      name: "Typelevel",
      mastery: 85,
      description: "fs2, http4s, doobie, cats-effect, cats, fs2-kafka",
    },
    {
      icon: "zio",
      name: "ZIO",
      mastery: 85,
      description: "zio-kafka, zio-config, zio-schema, zio-http, zio-json",
    },
    {
      icon: "docker",
      name: "Docker",
      mastery: 80,
      description: "",
    },
    {
      icon: "github",
      name: "GitHub Actions",
      mastery: 80,
      description: "GitLab CI",
    },
    {
      icon: "kafka",
      name: "Kafka",
      mastery: 80,
      description: "",
    },
    {
      icon: "swagger",
      name: "Protocols & data formats",
      mastery: 80,
      description:
        "OpenAPI, Avro, Protobuf, AsyncAPI, REST, gRPC, GraphQL, OpenAPI",
    },
    {
      icon: "rust",
      name: "Rust",
      mastery: 75,
      description: "tokio, axum, sqlx, reqwest, serde, clap, embassy",
    },
    {
      icon: "astro",
      name: "React",
      mastery: 70,
      description: "Next.js, Astro",
    },
    {
      icon: "kubernetes",
      name: "Kubernetes",
      mastery: 70,
      description: "HELM, ArgoCD",
    },
    {
      icon: "postgresql",
      name: "PostgreSQL",
      mastery: 70,
      description: "",
    },
    {
      icon: "typescript",
      name: "TypeScript / JavaScript",
      mastery: 70,
      description: "Frontend and scripting in general",
    },
    {
      icon: "opentelemetry",
      name: "Monitoring, tracing & profiling",
      mastery: 65,
      description: "OpenTelemetry, OpenTracing, flamegraphs and benchmarking",
    },
    {
      icon: "mysql",
      name: "MySQL",
      mastery: 65,
      description: "",
    },
    {
      icon: "mongodb",
      name: "MongoDB",
      mastery: 65,
      description: "",
    },
    {
      icon: "java",
      name: "Java",
      mastery: 60,
      description: "Spring, Hibernate, Jackson",
    },
    {
      icon: "redis",
      name: "Redis",
      mastery: 60,
      description: "",
    },
    {
      icon: "kotlin",
      name: "Kotlin",
      mastery: 60,
      description: "coroutines, flows, http4k",
    },
    {
      icon: "elastic",
      name: "Elastic stack",
      mastery: 50,
      description: "Elasticsearch and Kibana",
    },
    {
      icon: "csharp",
      name: "C#",
      mastery: 50,
      description: "ASP.NET MVC, Entity framework",
    },
    {
      icon: "fsharp",
      name: "F#",
      mastery: 50,
      description:
        "algebraic data types, pattern matching, type providers and asynchronous programming",
    },
    {
      icon: "haskell",
      name: "Haskell",
      mastery: 50,
      description: "aeson, scotty",
    },
  ],
  techCategories: [
    {
      category: "Design principles",
      detail:
        "Functional Programming, DRY, YAGNI, KISS, Hexagonal, DDD, Event Sourcing / CQRS",
    },
    {
      category: "Languages",
      detail:
        "Typed FP: Haskell, Scala, F# — Systems: Rust, C# — JVM: Java, Kotlin — Web/scripting: TypeScript/JavaScript, Shell",
    },
    {
      category: "Frontend",
      detail: "React, Next.js, Astro",
    },
    {
      category: "Backend / FP ecosystem",
      detail:
        "Scala: ZIO, Typelevel, http4s, Tapir, Caliban, sttp, Akka/Pekko — JVM: Spring, http4k — Rust: tokio, axum, sqlx, reqwest, serde",
    },
    {
      category: "Service protocols",
      detail:
        "REST, gRPC, GraphQL — Avro, Protobuf, JSON API — OpenAPI, AsyncAPI — OAuth2, OIDC, JWT",
    },
    {
      category: "Data & messaging",
      detail:
        "PostgreSQL, MySQL, SQLite — MongoDB, Redis — Elasticsearch, Kafka",
    },
    {
      category: "Networking",
      detail: "DNS, TCP/IP, UDP, TLS — Industrial/IoT: Modbus",
    },
    {
      category: "Security",
      detail:
        "SBOMs, Sonatype, SAST/DAST (Sonarqube) — Network & API security, Vault, SOPS",
    },
    {
      category: "Infrastructure",
      detail: "Docker, Talos — Kubernetes, Helm — ArgoCD, Pulumi — Sonatype Nexus",
    },
    {
      category: "CI/CD & build",
      detail: "Git, GitHub Actions, GitLab CI, Bazel, Docker",
    },
    {
      category: "Testing",
      detail:
        "Unit, Integration, Property-based, E2E, Fixture-based, Contract testing",
    },
    {
      category: "Observability",
      detail:
        "Prometheus, Grafana — OpenTelemetry — Flamegraphs — Benchmarking, Logging",
    },
    {
      category: "Concurrency",
      detail: "ZIO, Cats Effect — Akka/Pekko — Tokio — Akka Streams, FS2",
    },
    {
      category: "Embedded",
      detail: "ESP32, Raspberry Pi / Orange Pi — I2C, SPI, BLE, ADC",
    },
  ],
  certifications: [
    {
      image: "/img/cert/ckad.png",
      title: "Certified Kubernetes Application Developer (CKAD)",
      description:
        "Be able to define application resources and use core primitives to build, monitor, and troubleshoot scalable applications and tools in Kubernetes.",
    },
    {
      image: "/img/cert/coursera.png",
      title: "Machine Learning — Andrew Ng",
      description:
        "Machine learning is the science of getting computers to act without being explicitly programmed. In the past decade, machine learning has given us self-driving cars, speech recognition, web search, etc.",
    },
    {
      image: "/img/cert/nielsen-norman.png",
      title: "Interaction Design — Nielsen Norman",
      description:
        "Nielsen Norman Group, an elite firm dedicated to improving the everyday experience of using technology. I took courses on interaction design with the focus on apps.",
    },
    {
      image: "/img/cert/coursera.png",
      title: "Functional Programming in Scala — Martin Odersky",
      description:
        "Coursera specialization with Martin Odersky covering functional programming principles, the Scala type system, and parallel programming.",
    },
  ],
};
