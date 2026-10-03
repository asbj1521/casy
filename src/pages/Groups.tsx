import GroupsSection from "@/components/GroupsSection";
import InvitationsSection from "@/components/myEvents/InvitationsSection";
import TopNav from "@/components/TopNav";
import { useT } from "@/i18n/lang";

/**
 * Your groups and the invitations waiting for your answer: the phone's Groups
 * tab (TabBar). On a computer the same sections stay where they always were,
 * on the profile page and on My events, and nothing links here.
 */
export default function Groups() {
  const t = useT();

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-16 pt-2 sm:px-6 sm:pt-0 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.groupsPage.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.groupsPage.intro}</p>
        <InvitationsSection />
        <GroupsSection />
      </main>
    </div>
  );
}
