"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { motion } from "@/components/motion";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export function StatsCard({ title, value, subtitle, icon: Icon, trend, className }: StatsCardProps) {
  return (
    <motion.div
      className={cn("bg-layer-01 p-4 hover:bg-layer-hover transition-colors", className)}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-caption-01 text-muted-foreground">{title}</p>
          <p className="text-heading-05 mt-2">{value}</p>
          {subtitle && <p className="text-caption-01 text-muted-foreground mt-1">{subtitle}</p>}
          {trend && (
            <p className={cn("text-caption-01 mt-1", trend.positive ? "text-success" : "text-destructive")}>
              {trend.positive ? "+" : ""}{trend.value}% from last period
            </p>
          )}
        </div>
        <motion.div
          className="h-10 w-10 flex items-center justify-center bg-layer-02"
          whileHover={{ scale: 1.1, rotate: 5, transition: { duration: 0.2 } }}
        >
          <Icon className="h-5 w-5 text-primary" />
        </motion.div>
      </div>
    </motion.div>
  );
}
