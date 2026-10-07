/**
 * The scheduling page's settings to come (#98), in the order the settings
 * box's tabs and Flere indstillinger show them. Apart from the components
 * that draw them (ComingSoonSettings.tsx), so that file exports only
 * components, as React's fast refresh needs.
 */
export type ComingSoonSection = "people" | "repeat" | "prefs";

export const COMING_SOON: readonly ComingSoonSection[] = ["people", "repeat", "prefs"];
