import type { Metadata } from "next";
import { CSVImportWizard } from "@/components/imports/csv-import-wizard";

export const metadata: Metadata = {
  title: "Import",
  description: "Import expenses from CSV files and bank statements.",
};

export default function ImportsPage() {
  return (
    <div className="container mx-auto w-full max-w-4xl min-w-0 overflow-x-hidden px-4 py-8">
      <CSVImportWizard />
    </div>
  );
}
