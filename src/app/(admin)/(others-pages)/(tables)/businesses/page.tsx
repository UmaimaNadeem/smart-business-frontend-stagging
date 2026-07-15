import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import BusinessesTable from "@/components/tables/BusinessesTable";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Businesses | Smart Business Admin",
  description: "Manage businesses in Smart Business Admin",
};

export default function BusinessesPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Businesses" />
      <div className="space-y-6">
        <ComponentCard
          title="Businesses"
          desc="Create and manage business locations under each company."
        >
          <BusinessesTable />
        </ComponentCard>
      </div>
    </div>
  );
}
