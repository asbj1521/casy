import { Component, type ReactNode } from "react";
import { RotateCw } from "lucide-react";

import { currentMessages } from "@/i18n/current";

/**
 * The last line of defence: if something throws while the page is drawn, a
 * short note and a way to reload, instead of a blank page. Outside the
 * language provider's tree on purpose, so it reads the language the plain
 * way (currentMessages). The error still goes to the console.
 */
export default class CrashScreen extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("the page crashed", error);
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    const words = currentMessages().crash;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-[17px] font-semibold text-foreground">{words.title}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="glass-pill inline-flex h-11 items-center gap-2 rounded-full pl-4 pr-5 text-[17px] text-primary"
        >
          <RotateCw className="h-5 w-5" />
          {words.reload}
        </button>
      </div>
    );
  }
}
