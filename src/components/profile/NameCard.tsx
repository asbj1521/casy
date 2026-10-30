import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Pencil } from "lucide-react";

import { eventsQueryKey } from "@/api/events";
import {
  groupsQueryKey,
  setDisplayName,
  whoAmIQuery,
  whoAmIQueryKey,
  type WhoAmI,
} from "@/api/groups";
import { removeAvatar, setAvatar } from "@/api/pictures";
import InlineTextEdit from "@/components/InlineTextEdit";
import Avatar from "@/components/ui/Avatar";
import { displayName, useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/groups";
import { squarePicture } from "@/lib/pictureFile";
import { cn } from "@/lib/utils";

/**
 * Who you are, at the top of the profile: your picture (#187: tap it to pick
 * a photo, made into a small square on the phone before it is sent; "Fjern
 * billede" under the name takes it away), the name your groups see (tap it
 * to change it) and the email you sign in with. A name chosen here wins over the
 * login-derived one; until it has loaded, the login's stands in.
 */
export default function NameCard({ className }: { className?: string }) {
  const user = useSignedInUser();
  const t = useT();
  const queryClient = useQueryClient();
  const { data: whoAmI } = useQuery(whoAmIQuery(user.id));
  const name = whoAmI?.name ?? displayName(user);
  const [editing, setEditing] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  // Your picture is in the groups and events lists too: they are fetched again.
  const pictureChanged = (avatarUrl: string | null) => {
    queryClient.setQueryData<WhoAmI>(whoAmIQueryKey(user.id), (w) => w && { ...w, avatarUrl });
    void queryClient.invalidateQueries({ queryKey: groupsQueryKey(user.id) });
    void queryClient.invalidateQueries({ queryKey: eventsQueryKey(user.id) });
  };
  const picture = useMutation({
    mutationFn: async (file: File) => {
      let image: string;
      try {
        image = await squarePicture(file);
      } catch {
        throw new Error(t.pictures.unreadable);
      }
      return await setAvatar(image);
    },
    onSuccess: pictureChanged,
  });
  const unpicture = useMutation({
    mutationFn: removeAvatar,
    onSuccess: () => pictureChanged(null),
  });
  const hasPicture = !!whoAmI?.avatarUrl;
  const setName = useMutation({
    mutationFn: setDisplayName,
    onSuccess: (data) => {
      queryClient.setQueryData(whoAmIQueryKey(user.id), data);
      setEditing(false);
    },
  });

  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border bg-card p-4", className)}>
      <button
        type="button"
        onClick={() => picker.current?.click()}
        disabled={picture.isPending}
        aria-label={hasPicture ? t.pictures.change : t.pictures.add}
        className="relative shrink-0 rounded-full"
      >
        <Avatar name={name} index={0} size="lg" src={whoAmI?.avatarUrl} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-secondary text-foreground">
          {picture.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
      {/* Apple's own menu on a phone: the photos, the camera, a file. */}
      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) picture.mutate(file);
        }}
      />
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
        {hasPicture && !editing && (
          <button
            type="button"
            onClick={() => unpicture.mutate()}
            disabled={unpicture.isPending}
            className="mt-1 text-[13px] font-medium text-primary disabled:opacity-50"
          >
            {t.pictures.remove}
          </button>
        )}
        {(picture.error ?? unpicture.error) && (
          <p className="mt-1 text-[13px] text-red-600">
            {(picture.error ?? unpicture.error)?.message}
          </p>
        )}
      </div>
    </div>
  );
}
