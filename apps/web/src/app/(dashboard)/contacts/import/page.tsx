"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileSpreadsheet, Check, ArrowRight } from "lucide-react";

type Step = "upload" | "map" | "result";

export default function ImportContactsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Preview data from backend
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  // Column mapping
  const [phoneCol, setPhoneCol] = useState("");
  const [firstNameCol, setFirstNameCol] = useState("");
  const [lastNameCol, setLastNameCol] = useState("");
  const [emailCol, setEmailCol] = useState("");

  // Result
  const [result, setResult] = useState<{ imported: number; skipped: number; duplicates: number } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    setUploading(true);
    try {
      const res = await api.contacts.importPreview(f);
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      setHeaders(res.data!.headers);
      setPreview(res.data!.preview);
      setTotalRows(res.data!.total_rows);

      // Auto-map columns if names match
      const h = res.data!.headers.map((s) => s.toLowerCase());
      const phoneIdx = h.findIndex((c) => c.includes("phone") || c === "mobile" || c === "number" || c === "tel");
      const fnIdx = h.findIndex((c) => c.includes("first") || c === "fname");
      const lnIdx = h.findIndex((c) => c.includes("last") || c === "lname" || c === "surname");
      const emIdx = h.findIndex((c) => c.includes("email") || c === "mail");

      if (phoneIdx >= 0) setPhoneCol(res.data!.headers[phoneIdx]);
      if (fnIdx >= 0) setFirstNameCol(res.data!.headers[fnIdx]);
      if (lnIdx >= 0) setLastNameCol(res.data!.headers[lnIdx]);
      if (emIdx >= 0) setEmailCol(res.data!.headers[emIdx]);

      setStep("map");
    } catch (err: any) {
      toast.error(err.message || "Failed to preview CSV");
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !phoneCol) {
      toast.error("Phone number column is required");
      return;
    }

    setImporting(true);
    try {
      const res = await api.contacts.import(file, {
        phone_number_col: phoneCol,
        first_name_col: firstNameCol || undefined,
        last_name_col: lastNameCol || undefined,
        email_col: emailCol || undefined,
      });

      if (res.error) {
        toast.error(res.error.message);
        return;
      }

      setResult(res.data!);
      setStep("result");
      toast.success(`Imported ${res.data!.imported} contacts`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/contacts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Contacts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Upload a CSV file and map columns</p>
        </div>
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <Card>
          <CardContent className="p-8">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-12 flex flex-col items-center cursor-pointer hover:border-foreground/20 transition-colors"
            >
              {uploading ? (
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <>
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="font-medium">Click to upload CSV file</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supported format: .csv with headers
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </CardContent>
        </Card>
      )}

      {/* Step: Map Columns */}
      {step === "map" && (
        <>
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Column Mapping</p>
                  <p className="text-sm text-muted-foreground">
                    Map CSV columns to contact fields ({totalRows} rows detected)
                  </p>
                </div>
                <Badge variant="secondary">{headers.length} columns</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Phone Number * (required)</Label>
                  <Select
                    value={phoneCol}
                    onChange={(e) => setPhoneCol(e.target.value)}
                    className="mt-1.5"
                  >
                    <option value="">Select column...</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>First Name</Label>
                  <Select
                    value={firstNameCol}
                    onChange={(e) => setFirstNameCol(e.target.value)}
                    className="mt-1.5"
                  >
                    <option value="">-- None --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Select
                    value={lastNameCol}
                    onChange={(e) => setLastNameCol(e.target.value)}
                    className="mt-1.5"
                  >
                    <option value="">-- None --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Email</Label>
                  <Select
                    value={emailCol}
                    onChange={(e) => setEmailCol(e.target.value)}
                    className="mt-1.5"
                  >
                    <option value="">-- None --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Unmapped columns will be stored as metadata on each contact.
              </p>
            </CardContent>
          </Card>

          {/* Preview Table */}
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b">
                <p className="font-semibold text-sm">Preview (first {preview.length} rows)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {headers.map((h) => (
                        <th key={h} className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                          {h === phoneCol && <Badge className="ml-1 text-[10px]" variant="default">phone</Badge>}
                          {h === firstNameCol && <Badge className="ml-1 text-[10px]" variant="secondary">first</Badge>}
                          {h === lastNameCol && <Badge className="ml-1 text-[10px]" variant="secondary">last</Badge>}
                          {h === emailCol && <Badge className="ml-1 text-[10px]" variant="secondary">email</Badge>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        {headers.map((h) => (
                          <td key={h} className="p-3 text-muted-foreground whitespace-nowrap">
                            {row[h] || "--"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); }}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={handleImport} disabled={!phoneCol || importing}>
              <Upload className="h-4 w-4 mr-2" />
              {importing ? "Importing..." : `Import ${totalRows} Contacts`}
            </Button>
          </div>
        </>
      )}

      {/* Step: Result */}
      {step === "result" && result && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-bold">Import Complete</h2>
            <div className="flex justify-center gap-8 text-sm">
              <div>
                <p className="text-2xl font-bold text-success">{result.imported}</p>
                <p className="text-muted-foreground">Imported</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                <p className="text-muted-foreground">Skipped</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{result.duplicates}</p>
                <p className="text-muted-foreground">Duplicates</p>
              </div>
            </div>
            <Separator />
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); setResult(null); }}>
                Import More
              </Button>
              <Button onClick={() => router.push("/contacts")}>
                <ArrowRight className="h-4 w-4 mr-2" /> View Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
