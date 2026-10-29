/**
 * What the scheduling page searches for, set in one of two shapes of the
 * same controls: a box of tabs beside the answer on a wide screen
 * (SettingsPanel, #98), and a sentence you fill in on tablets ("fra kl. 18:00 i
 * 3 t på alle dage"), with Flere indstillinger a tap away. The phone's
 * Planlæg sheet has rows of its own (planFromCalendar/TimeRows, #173). All edit the same
 * settings and show only what applies: time, length and weekdays for one
 * meeting, or number of days and a start day for a trip or holiday, and in
 * both modes when (the months searched, #74). The name is only for the group
 * to read; the search never looks at it.
 */
export { SettingsPanel } from "./schedulerSettings/SettingsPanel";
export { SettingsSentence } from "./schedulerSettings/SettingsSentence";
