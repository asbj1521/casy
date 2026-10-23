import AppearanceGroup from "@/components/profile/AppearanceGroup";
import LanguageGroup from "@/components/profile/LanguageGroup";

/**
 * What Casy looks like to you (#129): language, and appearance (light, dark or
 * the system's, website only). A screen of its own on a phone (/profile/settings),
 * a section of the profile page on a computer.
 */
export default function SettingsGroups() {
  return (
    <>
      <LanguageGroup />
      <AppearanceGroup />
    </>
  );
}
