"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface CompanyProfile {
  id?: number;
  company_name: string;
  name?: string;
  tagline: string;
  business_type?: string;
  product_term?: string;
  product_term_plural?: string;
  pan_vat_no: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  logo_data: string;
  terms_and_conditions: string;
  invoice_footer: string;
  currency_symbol: string;
  updated_at?: string;
}

export const DEFAULT_COMPANY: CompanyProfile = {
  company_name: "Renew Gen Resources",
  name: "Renew Gen Resources",
  tagline: "Corporate Commercial & Supply Chain Management",
  business_type: "Commercial Trading & Distribution",
  product_term: "Product",
  product_term_plural: "Products",
  pan_vat_no: "610464122",
  phone: "+977 01-4573200",
  email: "info@renewgenresources.com",
  address: "Babarmahal, Kathmandu, Nepal",
  website: "www.renewgenresources.com",
  logo_data: "/logo.png",
  terms_and_conditions: (
    "1. Goods once sold are not returnable without authorization.\n" +
    "2. Warranty claims require original tax invoice & intact serial number.\n" +
    "3. Payment is due as per agreed invoice credit terms.\n" +
    "4. Subject to Kathmandu, Nepal jurisdiction."
  ),
  invoice_footer: "Thank you for your business! This is a computer-generated tax invoice.",
  currency_symbol: "NPR",
};

interface CompanyContextType {
  company: CompanyProfile;
  loading: boolean;
  refreshCompany: () => Promise<void>;
  updateCompany: (data: Partial<CompanyProfile>) => Promise<CompanyProfile>;
}

const CompanyContext = createContext<CompanyContextType>({
  company: DEFAULT_COMPANY,
  loading: true,
  refreshCompany: async () => {},
  updateCompany: async () => DEFAULT_COMPANY,
});

const STORAGE_KEY = "rg_company_profile";

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<CompanyProfile>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          return { ...DEFAULT_COMPANY, ...JSON.parse(cached) };
        }
      } catch (_) {}
    }
    return DEFAULT_COMPANY;
  });
  const [loading, setLoading] = useState(true);

  const refreshCompany = useCallback(async () => {
    try {
      const res = await api.get<CompanyProfile>("/api/company/profile");
      if (res && res.company_name) {
        const merged: CompanyProfile = {
          ...DEFAULT_COMPANY,
          ...res,
          name: res.company_name || res.name || DEFAULT_COMPANY.company_name,
        };
        setCompany(merged);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn("[CompanyContext] Failed to load company profile:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCompany = async (data: Partial<CompanyProfile>): Promise<CompanyProfile> => {
    const res = await api.put<{ status: string; company: CompanyProfile }>("/api/company/profile", data);
    const updated = res.company || { ...company, ...data };
    const merged: CompanyProfile = {
      ...DEFAULT_COMPANY,
      ...updated,
      name: updated.company_name || updated.name || DEFAULT_COMPANY.company_name,
    };
    setCompany(merged);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch (_) {}
    }
    return merged;
  };

  useEffect(() => {
    refreshCompany();
  }, [refreshCompany]);

  // Dynamically update document title with company name
  useEffect(() => {
    if (typeof document !== "undefined" && company.company_name) {
      const currentTitle = document.title;
      // If title is generic or default, update it
      if (!currentTitle || currentTitle.includes("Renew Gen") || currentTitle.includes("ERP")) {
        document.title = `${company.company_name} — ERP System`;
      }
    }
  }, [company.company_name]);

  return (
    <CompanyContext.Provider value={{ company, loading, refreshCompany, updateCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
