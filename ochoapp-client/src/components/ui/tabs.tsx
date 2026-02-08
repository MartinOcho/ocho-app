"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

export type TabVariants =
  | "default"
  | "soft"
  | "outline"
  | "underline";

// Configuration des variants
const tabsConfig = {
  list: {
    default: "bg-card/50 sm:bg-card",
    soft: "bg-none sm:bg-none gap-4 sm:gap-4 h-fit",
    outline: "border bg-transparent h-fit ",
    underline: "border-b bg-transparent rounded-none sm:rounded-none ",
  },
  trigger: {
    default:
      "hover:bg-background data-[state=active]:bg-background data-[state=active]:font-bold data-[state=active]:text-foreground",
    soft: "bg-card/80 hover:bg-accent data-[state=active]:bg-primary hover:data-[state=active]:bg-primary/80 data-[state=active]:text-primary-foreground rounded-3xl px-4",
    outline:
      "border data-[state=active]:border-primary/50 data-[state=active]:bg-card data-[state=active]:text-foreground hover:bg-accent/30",
    underline:
      "rounded-none border-b-4 border-transparent data-[state=active]:bg-card data-[state=active]:border-primary data-[state=active]:text-foreground hover:bg-card/50",
  },
} satisfies Record<"list" | "trigger", Record<TabVariants, string>>;

const TabsVariantContext = React.createContext<TabVariants>("default");

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: TabVariants;
    scrollable?: boolean;
  }
>(({ className, variant = "default", scrollable = false, ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex h-12 w-full items-center gap-1.5 p-1.5 text-muted-foreground shadow-sm sm:gap-1 sm:rounded-md sm:p-1 overflow-auto",
        scrollable &&
          "grid auto-cols-max grid-flow-col justify-start overflow-hidden overflow-x-auto sm:gap-1",
        tabsConfig.list[variant],
        className,
      )}
      {...props}
    />
  </TabsVariantContext.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex h-full flex-1 items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variant !== "underline" && "rounded-sm",
        tabsConfig.trigger[variant],
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
