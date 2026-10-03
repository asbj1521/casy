import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import { setDisplayName, whoAmIQuery, whoAmIQueryKey } from "@/api/groups";
import InlineTextEdit from "@/components/InlineTextEdit";
import Avatar from "@/components/ui/Avatar";
import { displayName, useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/groups";
import { cn } from "@/lib/utils";

/**
 * Who you are, at the top of the profile: the name your groups see (tap it to
 * change it) and the email you sign in with. A name chosen here wins over the
 * login-derived one; until it has loaded, the login's stands in.
 */
export default function NameCard({ className }: { className?: string }) {
  const user = useSignedInUser();
  const t = useT();
  const queryClient = useQueryClient();
  const { data: whoAmI } = useQuery(whoAmIQuery(user.id));
  const name = whoAmI?.name ?? displayName(user);
  const [editing, setEditing] = useState(false);
  const setName = useMutation({
    mutationFn: setDisplayName,
    onSuccess: (data) => {
      queryClient.setQueryData(whoAmIQueryKey(user.id), data);
      setEditing(false);
    },
  });

  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border bg-card p-4", className)}>
      <Avatar name={name} index={0} size="lg" />
      <div className="min-w-0 flex-1">
        {editing ? (
          <InlineTextEdit
            value={name}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            submitting={setName.isPending}
            error={setName.error?.message ?? null}
            inputClassName="text-lg font-bold"
            onSubmit={(newName) => setName.mutate(newName)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setName.reset();
              setEditing(true);
            }}
            aria-label={t.profile.changeName}
            className="group flex w-full items-center gap-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-bold leading-tight text-foreground">
                {name}
              </span>
              {/* Under a Google name, the email says which account this is;
                  when the email is already the name, it would only repeat it. */}
              {user.email && user.email !== name && (
                <span className="block truncate text-sm text-muted-foreground">{user.email}</span>
              )}
            </span>
            <Pencil className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
