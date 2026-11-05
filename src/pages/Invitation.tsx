import { Navigate, useParams } from "react-router-dom";

import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { sheetAddress } from "@/lib/profileScreens";

/**
 * An invitation by name (/invited/:groupId), where its notification leads. A
 * phone opens it as a screen in the Profil sheet (#224, InvitationContent); a
 * computer answers on its cards under Groups.
 */
export default function Invitation() {
  const { groupId = "" } = useParams();
  const phone = usePhoneLayout();
  return <Navigate to={phone ? sheetAddress(`invited/${groupId}`) : "/groups"} replace />;
}
