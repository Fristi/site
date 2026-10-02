---
pubDate: "2026-06-12"
banner: "/img/blog/banner_functional_scala.jpg"
title: "mail-rag: knowledge graphs and semantic search over email"
description: "A Scala 3 pipeline that ingests EML, extracts a knowledge graph with LLMs, anchors entities symbolically, and exposes multi-corpus retrieval over MCP"
draft: false
---

Email archives are a gold mine and a graveyard at the same time. Years of decisions, commitments, and context live in threads you can grep but not really *ask*. Vector search over raw chunks helps, but it misses structure: who decided what, which project a thread belongs to, how entities cluster across a mailbox.

**mail-rag** is a Scala 3 pipeline that closes that gap. It ingests RFC822 mail, decomposes messages into searchable chunks, runs structured LLM extraction per chunk, merges the results into a Neo4j knowledge graph, embeds several purpose-built corpuses, and exposes semantic search plus original artifacts over MCP.

Source and configuration reference: [github.com/Fristi/mail-rag](https://github.com/Fristi/mail-rag).

## Two entry points, one graph

The system splits cleanly into batch ingestion and query-time retrieval:

| Entry point | Command | Role |
|-------------|---------|------|
| Ingestion pipeline | `sbt app/run` | Parse EML, extract, anchor, persist, index, optional Leiden clustering |
| MCP server | `sbt mcpServer/run` | HTTP MCP at `/mcp` for semantic search and artifact fetch |

The batch job is cats-effect + fs2: parallel EML parsing, bounded concurrency for chunk extraction, resumable checkpoints when Neo4j is enabled. The MCP server is ZIO + zio-http — a deliberate split so agents and IDEs can query a running graph without pulling in pipeline tuning, anchoring flags, or Leiden configuration.

At query time the MCP server exposes three tools:

- `neo4j_search` — embed the user query and search configured corpuses
- `fetch_email_artifact` — retrieve original RFC822 for a `messageId`
- `fetch_attachment_artifact` — retrieve attachment payload by content hash

That last pair matters for RAG that can cite sources: search returns snippets and provenance; fetch returns the actual mail.

## From EML to chunks

Before any LLM runs, mail is parsed and normalized into chunks worth extracting over.

**RFC822 parsing** uses JavaMail for envelope metadata — Message-ID, References, In-Reply-To, addresses, sent time. HTML bodies convert to plain text via Jsoup.

**Structural decomposition** splits a message into header, body, quoted-reply blocks (`On … wrote:`), signature (`-- `), and attachment metadata. An optional automated-mail filter skips invitations, calendar notices, OOO replies, and delivery-status messages that add noise without semantic value.

**Sentence-aware chunking** bounds each chunk by token count with configurable overlap, so extraction calls stay within model limits without cutting mid-sentence.

**Thread context** resolves a thread ID from reply headers and prefixes chunks with conversational context plus a turn index. A reply that says "sounds good" becomes searchable because the chunk carries what it was replying to.

Each chunk gets a stable ID, message/thread linkage, and optional SHA-256 of the raw artifact for deduplication downstream.

## Structured extraction per chunk

For each chunk, an OpenAI chat call with JSON schema / structured output returns entities, relations, and date mentions. The extraction ontology covers node labels like Person, Organization, Project, Topic, Decision, Action, Document, and Event — plus semantic relations such as SentTo, Decides, AssignedTo, BlockedBy, PartOf, References, and FollowsUp.

Date mentions stay verbatim in the model output; the system resolves absolute and relative dates using the email's send time, not the prompt. That keeps the LLM from inventing calendar math.

A separate **structural extractor** assembles the graph skeleton around the semantic payload: Email, Thread, Chunk, and Date nodes with edges like BelongsTo, Contains, HasChunk, SentTo, InReplyTo, SentOn, and MentionedIn. Structural and semantic graphs merge before anchoring and persist.

Parallelism is bounded per message (`OPENAI_CHUNK_EXTRACTION_MAX_CONCURRENCY`) so a long thread does not open fifty simultaneous API calls.

## Symbolic anchoring: when vectors are not enough

LLM extraction is good at spotting that "Mark" and "M. de Jong" might be the same person. It is bad at *committing* to a canonical identity across thousands of messages without drift.

mail-rag runs a **symbolic anchoring cascade** after extraction:

```
mention ──► exact email ──► exact name ──► alias match ──► fuzzy ──► embedding ──► LLM disambiguation
```

`SymbolicAnchorService` walks this ladder for people and organizations. Header participants are indexed first — if the model mentions an address that appeared in To/Cc/From, that match wins at confidence 1.0. Normalized names, participant-scoped aliases, email local-part variants (`MarkJ` → `mark.dejong@…`), and fuzzy string matches follow. Only when symbolic rules exhaust does the pipeline fall back to embedding similarity or an LLM disambiguation call.

Resolved identities land in an `IdentityStore` — in-memory when Neo4j is off, persisted as `PersonIdentity` / `OrganizationIdentity` nodes when it is on. The index accumulates observed name variants so "Mark", "M. de Jong", and `mark.dejong@vectos.net` converge on one canonical ref.

This hybrid design is the architectural bet: let the LLM propose entities freely, then ground them with deterministic rules and cheap lookups before paying for another model call. OpenTelemetry counters track how often embedding and LLM disambiguation actually fire — useful when tuning cost.

## Neo4j as the system of record

When `NEO4J_ENABLED=true`, the full message graph persists in batched writes: emails, threads, chunks, extracted entities and edges, resolved dates, and content-hash-deduplicated attachments.

Schema bootstrap creates uniqueness constraints on ontology node IDs, identity canonical IDs, ingest checkpoints, and attachment hashes. Ingest checkpoints make long folder scans resumable — if a batch dies at message 4,200, the next run picks up from there.

**GDS Leiden clustering** (optional) projects the entity subgraph and writes `communityId` onto nodes. That feeds the community-summary corpus and answers theme-level questions that span many threads.

Attachments flow through Apache Tika for text extraction, a validation chain (MIME allowlist, size cap, encryption probe, optional ClamAV), and SHA-256 hashing for graph identity and MCP fetch.

## Four corpuses, one vector index

Naive RAG embeds chunk text and stops. mail-rag indexes **four embedding targets** — separate searchable views over the same mailbox, each tuned for a different question shape:

| Target | What gets embedded | Best for |
|--------|-------------------|----------|
| `chunk` | Chunk body with thread context prefix | Exact passages, quotes, fine-grained facts |
| `email_summary` | LLM one-paragraph summary per message | "What was this email about?" |
| `entity_context` | Graph-derived dossier per entity | "Who is X?" / "What do we know about project Y?" |
| `community_summary` | LLM summary per Leiden community | Themes and cross-cutting topics |

All targets share a single Neo4j vector index (`embedded_documents`). Queries filter by `target` in Cypher — Neo4j 5.26 does not support per-target vector indexes with `WHERE` on index creation, so the router over-fetches candidates and merges across corpuses.

Indexing runs at three lifecycle points:

1. **Per message** — chunks and email summaries after extraction and persist
2. **Post-batch** — entity dossiers rebuilt from `MENTIONED_IN` provenance across the full graph
3. **Post-Leiden** — community summaries once `communityId` is assigned

Re-runs are cheap. A per-message content hash skips all per-message work when body chunks are unchanged; per-document `textHash` skips re-embedding when a summary or dossier text is identical.

At query time, `Neo4jQueryRouter` embeds the user query, searches each enabled target, merges hits by score, and returns `Citation`s with docId, target, score, message/chunk/thread IDs, subject, sent time, from address, and a snippet.

## Artifacts and MCP

Search without source access is half a RAG system. mail-rag stores original RFC822 and attachment bytes in a local directory tree or S3-compatible object storage. The MCP fetch tools look up metadata in Neo4j and return previews, download URLs, or base64 within a configurable size cap.

That lets an agent search semantically, cite a specific message, and pull the original mail to verify a claim — without re-ingesting or guessing file paths.

## Observability built in

The ingestion pipeline auto-configures OpenTelemetry on startup. Gauges track mails, chunks, extractions, persist, and index rates per second. Histograms break down phase latency (chunk, extract, anchor, persist, index) with p50/p95 views. Ingest progress reports folder size, resume index, and percent complete.

Docker Compose bundles Neo4j 5.26 Community (with GDS and JVM vector module flags) and a Grafana otel-lgtm stack. A provisioned **mail-rag Pipeline** dashboard becomes the home dashboard when you bring up the local LGTM service.

`scripts/benchmark-pipeline.sh` runs preset profiles for throughput baselines — useful when tuning parallelism or comparing anchoring strategies.

## Module layout

The SBT build mirrors the pipeline stages:

| Module | Responsibility |
|--------|----------------|
| `mail` / `mail-eml` / `mail-imap` | Core models, EML folder store, IMAP client |
| `chunker` | Parse, decompose, chunk, thread context |
| `extraction` | LLM extraction, anchoring, structural merge |
| `llm` | OpenAI adapters for extraction, anchoring, embeddings |
| `neo4j-persist` | Schema, persist, identity store, Leiden, checkpoints |
| `index` | Multi-corpus indexing pipeline |
| `retrieval` | Vector search, citations, query router |
| `attachment` / `artifact` | Tika extract, validation, local/S3 stores |
| `observability` | OTel metrics, tracing, benchmark snapshots |
| `app` | Batch orchestration |
| `mcp-server` | MCP HTTP server |

Configuration is entirely environment-driven via Ciris — copy `.env.example`, point `MAIL_EML_PATH` at a folder of `.eml` files, set `OPENAI_API_KEY`, bring up Neo4j, and run.

## When this fits

mail-rag fits when:

- You have a corpus of email (or exported `.eml` archives) and want semantic search with graph-aware entity resolution, not just chunk similarity.
- Agents or tools need MCP access to search mail and fetch originals.
- You want observability and resumable ingest on a long batch, not a one-off notebook script.

It is less suited when:

- You need live IMAP sync as the primary ingestion path (the IMAP module exists but is not wired as an app strategy yet).
- Your mail has no graph database and no budget for LLM extraction — chunk-only RAG without anchoring is supported, but the interesting parts assume Neo4j.
- Sub-second search over billions of messages is the goal (this is a batch pipeline with vector search, not a distributed search engine).

## Quick start

```bash
docker compose up -d neo4j lgtm
cp .env.example .env   # edit MAIL_EML_PATH, OPENAI_API_KEY, etc.
sbt app/run
sbt mcpServer/run
```

Point your MCP client at `http://localhost:8080/mcp`, enable the corpuses that match your questions in `RETRIEVAL_TARGETS`, and search.

If you want to dig in, start with the [README](https://github.com/Fristi/mail-rag) and the [indexing guide](https://github.com/Fristi/mail-rag/blob/main/docs/indexing.md). Feedback and PRs welcome on GitHub.
