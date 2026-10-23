import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import ProfilePageTop from "@/components/ProfilePageTop";
import AppBackLink from "@/components/welcome/AppBackLink";

/**
 * The privacy policy's and the terms' shared page: a title, when it last
 * changed, and plain sections. Both keep their own Danish and English copy in
 * their page file; this only lays it out, so the two read as one set.
 */

/** Where people write about their data, their account or the terms. */
const CONTACT_EMAIL = "asbjornbay@gmail.com";

export const ContactEmail = () => (
  <a
    href={`mailto:${CONTACT_EMAIL}`}
    className="font-medium text-foreground underline underline-offset-2"
  >
    {CONTACT_EMAIL}
  </a>
);

/** A word a paragraph or list item is about, set slightly apart. */
export const Term = ({ children }: { children: ReactNode }) => (
  <span className="font-medium text-foreground">{children}</span>
);

export interface LegalCopy {
  title: string;
  updated: string;
  /** `id` makes a section linkable (/privacy#ai); the page scrolls to it when it opens. */
  sections: { id?: string; title: string; body: ReactNode }[];
}

export default function LegalPage({ copy }: { copy: LegalCopy }) {
  // The router doesn't scroll to a #section by itself, and this page loads lazily.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  return (
    <div className="min-h-screen bg-background">
      <ProfilePageTop />
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4 sm:px-6 sm:pb-20 sm:pt-6">
        <AppBackLink className="mb-4" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.updated}</p>
        {copy.sections.map((section) => (
          <section key={section.title} id={section.id} className="mt-8 scroll-mt-20">
            <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
