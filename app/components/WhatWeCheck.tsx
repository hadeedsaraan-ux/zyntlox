import { CursorIcon, GlobeIcon, PaletteIcon, ShieldIcon } from "./Icons";

const areas = [
  {
    Icon: PaletteIcon,
    title: "Design",
    body: "Layout, visual hierarchy and readability — does the page guide the eye or fight it?",
  },
  {
    Icon: ShieldIcon,
    title: "Trust",
    body: "Contact details, policies and social proof — would a stranger hand you their card?",
  },
  {
    Icon: CursorIcon,
    title: "UX",
    body: "Navigation, calls to action and forms — can visitors actually do what you want?",
  },
  {
    Icon: GlobeIcon,
    title: "SEO basics",
    body: "Titles, descriptions, headings, alt text and indexability — can people find you?",
  },
];

export default function WhatWeCheck() {
  return (
    <section className="w-full max-w-5xl pt-10" aria-labelledby="what-we-check">
      <div className="mb-8 flex flex-col items-center text-center">
        <p className="eyebrow mb-3">What Magpie looks at</p>
        <h2 id="what-we-check" className="font-display text-4xl sm:text-5xl">
          Four things visitors judge in seconds
        </h2>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {areas.map(({ Icon, title, body }) => (
          <li key={title} className="card p-5">
            <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent">
              <Icon />
            </span>
            <h3 className="mb-1.5 font-semibold text-ink">{title}</h3>
            <p className="text-sm leading-relaxed text-muted">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
