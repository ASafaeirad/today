import { Link } from "@tanstack/react-router";

import { cn } from "#lib/cn";

import { Text } from "../Text/Text.tsx";

type NavItemProps = {
  to: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  className?: string;
};

function NavItem({ to, label, icon, active = false, className }: NavItemProps) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        active && "bg-accent text-accent-foreground",
        className,
      )}
    >
      <span className="size-5 [&_svg]:size-5">{icon}</span>
      <Text size="xs" weight="medium">
        {label}
      </Text>
    </Link>
  );
}

export { NavItem };
