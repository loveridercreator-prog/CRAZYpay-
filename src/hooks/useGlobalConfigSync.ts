import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface AppConfig {
  id?: string;
  appTitle?: string;
  usdtRate?: number;
  usdt_rate?: number;
  rewardPercent?: number;
  reward_ratio?: number;
  referEarnAmount?: number;
  inr_reward?: number;
  min_sell?: number;
  max_sell?: number;
  min_buy?: number;
  max_buy?: number;
  notice_message?: string;
  notice_bg_url?: string;
  notice_bg_active?: boolean;
  app_download_url?: string;
  app_download_title?: string;
  telegramPersonalLink?: string;
  telegramGroupLink?: string;
  secretTradingLink?: string;
  [key: string]: unknown;
}

export function useGlobalConfigSync() {
  const [config, setConfig] = useState<AppConfig | null>(null);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase.from("app_config").select("*").single();
      if (data && !error) {
        setConfig(data as AppConfig);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("system-config-updated", { detail: data }));
        }
      }
    } catch (err) {
      console.warn("Error loading app config:", err);
    }
  };

  useEffect(() => {
    loadConfig();
    // Establish real-time subscription to catch admin updates instantly across all client instances
    const subscription = supabase
      .channel("public:app_config")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_config" },
        (payload) => {
          if (payload.new) {
            setConfig(payload.new as AppConfig);
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("system-config-updated", { detail: payload.new }),
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return { config, refreshConfig: loadConfig };
}
