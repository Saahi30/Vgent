"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Link2,
  Trash2,
  FileText,
  Search,
  RefreshCw,
  Loader2,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function KnowledgeBaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [kb, setKb] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("documents");

  // Upload state
  const [uploading, setUploading] = useState(false);

  // URL import
  const [urlInput, setUrlInput] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);

  // Search / test retrieval
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const loadData = useCallback(() => {
    Promise.all([
      api.knowledgeBases.get(kbId),
      api.knowledgeBases.documents(kbId),
    ])
      .then(([kbRes, docsRes]) => {
        setKb(kbRes.data);
        setDocuments(docsRes.data || []);
      })
      .catch(() => toast.error("Failed to load knowledge base"))
      .finally(() => setLoading(false));
  }, [kbId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh documents that are still processing
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      api.knowledgeBases.documents(kbId)
        .then((res) => setDocuments(res.data || []))
        .catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [documents, kbId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await api.knowledgeBases.uploadDocument(kbId, file);
      if (res.error) {
        toast.error(res.error.message);
      } else {
        toast.success(`Uploading "${file.name}" — indexing in progress`);
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlImport = async () => {
    if (!urlInput.trim()) return;
    setImportingUrl(true);
    try {
      await api.knowledgeBases.importUrl(kbId, urlInput.trim());
      toast.success("URL import started — indexing in progress");
      setUrlInput("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "URL import failed");
    } finally {
      setImportingUrl(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await api.knowledgeBases.deleteDocument(kbId, docId);
      toast.success("Document deleted");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.knowledgeBases.search(kbId, searchQuery.trim());
      setSearchResults(res.data || []);
      if ((res.data || []).length === 0) {
        toast.info("No relevant results found");
      }
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "ready": return <CheckCircle className="h-4 w-4 text-success" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      case "processing": return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const fileTypeIcon = (contentType: string) => {
    if (contentType?.includes("pdf")) return "PDF";
    if (contentType?.includes("word") || contentType?.includes("docx")) return "DOCX";
    if (contentType?.includes("csv")) return "CSV";
    if (contentType?.includes("html")) return "URL";
    return "TXT";
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (!kb) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Knowledge base not found</p>
        <Button variant="outline" onClick={() => router.push("/knowledge-bases")} className="mt-4">Back</Button>
      </div>
    );
  }

  const totalChunks = documents.reduce((sum: number, d: any) => sum + (d.chunk_count || 0), 0);
  const readyDocs = documents.filter((d) => d.status === "ready").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/knowledge-bases")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">{kb.name}</h1>
            </div>
            {kb.description && (
              <p className="text-muted-foreground text-sm mt-0.5">{kb.description}</p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Documents</p>
            <p className="text-2xl font-bold">{documents.length}</p>
            <p className="text-xs text-muted-foreground">{readyDocs} ready</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Chunks</p>
            <p className="text-2xl font-bold">{totalChunks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="text-sm font-medium mt-1">{formatDate(kb.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="search">Test Retrieval</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <div className="space-y-4">
            {/* Upload Actions */}
            <div className="flex gap-3">
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div className="flex gap-2 flex-1">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/page-to-index"
                  onKeyDown={(e) => e.key === "Enter" && handleUrlImport()}
                />
                <Button variant="outline" onClick={handleUrlImport} disabled={importingUrl || !urlInput.trim()}>
                  {importingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                  {importingUrl ? "" : "Import URL"}
                </Button>
              </div>
            </div>

            {/* Document List */}
            <Card>
              <CardContent className="p-0">
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mb-3" />
                    <p className="font-medium">No documents yet</p>
                    <p className="text-sm">Upload files or import URLs to build your knowledge base</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-4 font-medium text-muted-foreground">Document</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Chunks</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-4 font-medium text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc: any) => (
                        <tr key={doc.id} className="border-b border-border hover:bg-accent">
                          <td className="p-4">
                            <p className="font-medium truncate max-w-xs" title={doc.file_name}>
                              {doc.file_name || "Untitled"}
                            </p>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">{fileTypeIcon(doc.content_type)}</Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              {statusIcon(doc.status)}
                              <span className="capitalize">{doc.status}</span>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">{doc.chunk_count || 0}</td>
                          <td className="p-4 text-muted-foreground">{formatDate(doc.created_at)}</td>
                          <td className="p-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteDoc(doc.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Test Retrieval Tab */}
        <TabsContent value="search">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Test Query</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Enter a question to test what your agent would retrieve from this knowledge base
                </p>
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g., What is the return policy?"
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    {searching ? "" : "Search"}
                  </Button>
                </div>
              </div>

              {searchResults.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-3">
                      {searchResults.length} relevant chunk{searchResults.length !== 1 ? "s" : ""} found
                    </p>
                    <div className="space-y-3">
                      {searchResults.map((chunk: any, i: number) => (
                        <div key={i} className="p-4 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary">#{i + 1}</Badge>
                            {chunk.similarity != null && (
                              <Badge variant="outline">
                                {(chunk.similarity * 100).toFixed(1)}% match
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{chunk.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
