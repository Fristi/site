#let cv = json("cv.json")

#let accent = rgb("#2563EB")
#let muted = rgb("#6B7280")
#let divider = rgb("#E5E7EB")

#set document(title: cv.name + " - CV", author: cv.name)
#set page(
  paper: "a4",
  margin: (x: .7cm, y: .5cm),
)
#set text(size: 8pt, lang: "en")
#set par(leading: 0.65em)

#let rule-line() = {
  v(0.3em)
  line(length: 100%, stroke: 0.5pt + divider)
  v(0.5em)
}

#let section-heading(title) = {
  rule-line()
  text(weight: "bold", size: 11pt, fill: accent, upper(title))
  v(0.6em)
}

#let kv-row(key, value) = {
  grid(
    columns: (5.5cm, 1fr),
    gutter: 0.5em,
    text(weight: "semibold", size: 9pt, key),
    text(size: 9pt, value),
  )
  v(0.25em)
}

#let named-row(name, desc) = {
  grid(
    columns: (3.5cm, 1fr),
    gutter: 0.5em,
    text(weight: "semibold", size: 9pt, name),
    text(size: 9pt, desc),
  )
  v(0.2em)
}

#let bullet-body(b) = {
  if b.lead != "" {
    [*#b.lead* — #b.text]
  } else {
    b.text
  }
}

#let job(entry) = {
  grid(
    columns: (1fr, auto),
    text(weight: "semibold", size: 10.5pt, entry.role + " — " + entry.company),
    text(fill: muted, size: 9pt, entry.period),
  )
  v(0.35em)
  for b in entry.bullets [
    #pad(left: 0.8em)[
      • #bullet-body(b)
    ]
  ]
  if entry.skills.len() > 0 {
    v(0.2em)
    pad(left: 0.8em)[
      #text(
        fill: muted,
        size: 6.5pt,
        style: "italic",
        "Skills: " + entry.skills.join(", "),
      )
    ]
  }
  v(0.7em)
}

#grid(
  columns: (1fr, auto),
  align: (left, right),
  [
    #text(size: 22pt, weight: "bold", cv.name)
    #v(0.3em)
    #text(size: 9.5pt, fill: muted)[
      #link(cv.website)[#cv.websiteLabel] #h(1em)
      #link(cv.github)[#cv.githubLabel]
    ]
  ],
)

#section-heading("Introduction")

#text(size: 9.5pt)[
  #cv.introduction.join("\n\n")
]

#section-heading("Work Experience")

#for entry in cv.experience {
  job(entry)
}

#section-heading("Certifications")

#grid(
  columns: (1fr, 1fr),
  gutter: 0.4em,
  ..cv.certifications.map(c => [• #c.title]),
)

#section-heading("Talks")

#for talk in cv.talks {
  named-row(
    if talk.url != "" { link(talk.url)[#talk.name] } else { talk.name },
    talk.description,
  )
}

#section-heading("Solo Open Source Projects")

#for project in cv.projects {
  named-row(
    if project.url != "" { link(project.url)[#project.name] } else { project.name },
    project.description,
  )
}

#v(0.3em)
#text(size: 8.5pt, fill: muted)[
  All projects and talk slides available at #link(cv.github)[#cv.githubLabel]
]

#section-heading("Tech & Methodologies")

#for cat in cv.techCategories {
  kv-row(cat.category, cat.detail)
}
