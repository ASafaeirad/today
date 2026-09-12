import { Text } from "#ui";

interface AppShellProps {
  children: React.ReactNode;
  version: string;
}

export function AppShell({ children, version }: AppShellProps) {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <div className="min-h-0 flex-1">{children}</div>
      <footer className="flex justify-end border-t border-border bg-chrome px-2.5 py-1">
        <Text as="code" size="xs" tone="subtle" tracking="wide">
          version {version}
        </Text>
      </footer>
    </div>
  );
}
