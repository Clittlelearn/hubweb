import { OpenHiveLogo } from "./openhive-logo";

export function RouteLoadingScreen() {
  return (
    <div className="min-h-screen bg-background px-4 text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-border/50 bg-card/80 p-8 text-center shadow-2xl backdrop-blur-sm">
          <div className="mb-5 flex justify-center">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
              <OpenHiveLogo size={40} />
            </div>
          </div>
          <p className="text-lg font-semibold text-white">Loading HiveX Hub</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Preparing the next route chunk and wallet state.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
