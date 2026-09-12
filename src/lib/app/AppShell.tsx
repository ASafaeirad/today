import { Text } from "#ui";

const buildVersion = import.meta.env.VITE_APP_VERSION || "dev";

interface AppShellProps {
  children: React.ReactNode;
  version?: string;
}

export function AppShell({ children, version = buildVersion }: AppShellProps) {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <div className="min-h-0 flex-1">{children}</div>
      <footer className="flex justify-end border-t border-border bg-chrome px-2.5 py-1">
        <Text as="code" size="xs" tone="subtle" tracking="wide">
          version {version.slice(0, 7)}
        </Text>
      </footer>
    </div>
  );
}
