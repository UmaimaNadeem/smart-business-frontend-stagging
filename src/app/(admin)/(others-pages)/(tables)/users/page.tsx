import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import UsersTable from "@/components/tables/UsersTable";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "SB Users | UNAdmin - SB Dashboard Template",
  description:
    "This is SB BUsers  page for UNAdmin  Tailwind CSS Admin Dashboard Template",
  // other metadata
};

export default function UsersPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Users" />
      <div className="space-y-6">
        <ComponentCard title="Users">
          <UsersTable />
        </ComponentCard>
      </div>
    </div>
  );
}
