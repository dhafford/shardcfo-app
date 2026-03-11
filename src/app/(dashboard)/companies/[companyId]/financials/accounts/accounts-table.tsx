"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Archive,
  Check,
  X,
  Loader2,
  LayoutTemplate,
} from "lucide-react";
import {
  createAccount,
  updateAccount,
  archiveAccount,
  initializeFromTemplate,
} from "./actions";
import type { AccountRow, AccountType } from "@/lib/supabase/types";
import { toast } from "sonner";

interface AccountsTableProps {
  companyId: string;
  accounts: AccountRow[];
}

type TemplateType = "saas" | "ecommerce" | "professional_services" | "blank";

const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "revenue", label: "Revenue" },
  { value: "cogs", label: "COGS" },
  { value: "opex", label: "OpEx" },
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "other", label: "Other" },
];

const TYPE_BADGE_CLASS: Record<AccountType, string> = {
  revenue: "bg-green-100 text-green-800 border-green-200",
  cogs: "bg-orange-100 text-orange-800 border-orange-200",
  opex: "bg-blue-100 text-blue-800 border-blue-200",
  asset: "bg-purple-100 text-purple-800 border-purple-200",
  liability: "bg-red-100 text-red-800 border-red-200",
  equity: "bg-slate-100 text-slate-800 border-slate-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

interface EditState {
  accountId: string;
  code: string;
  name: string;
  account_type: AccountType;
}

interface NewAccountState {
  code: string;
  name: string;
  account_type: AccountType;
}

const BLANK_NEW_ACCOUNT: NewAccountState = {
  code: "",
  name: "",
  account_type: "revenue",
};

export function AccountsTable({ companyId, accounts: initialAccounts }: AccountsTableProps) {
  const [accounts, setAccounts] = React.useState<AccountRow[]>(initialAccounts);
  const [editState, setEditState] = React.useState<EditState | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [newAccount, setNewAccount] = React.useState<NewAccountState>(BLANK_NEW_ACCOUNT);
  const [saving, setSaving] = React.useState(false);
  const [initializingTemplate, setInitializingTemplate] = React.useState(false);

  // Keep accounts in sync with server-rendered initial state (soft update on SPA nav)
  React.useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);

  // ---------------------------------------------------------------------------
  // Edit handlers
  // ---------------------------------------------------------------------------

  const startEdit = (acc: AccountRow) => {
    setEditState({
      accountId: acc.id,
      code: acc.code ?? "",
      name: acc.name,
      account_type: acc.account_type,
    });
  };

  const cancelEdit = () => setEditState(null);

  const saveEdit = async () => {
    if (!editState) return;
    setSaving(true);
    const result = await updateAccount(companyId, editState.accountId, {
      code: editState.code,
      name: editState.name,
      account_type: editState.account_type,
    });
    setSaving(false);
    if (result.success) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editState.accountId
            ? {
                ...a,
                code: editState.code || null,
                name: editState.name,
                account_type: editState.account_type,
              }
            : a
        )
      );
      setEditState(null);
      toast.success("Account updated.");
    } else {
      toast.error(result.error ?? "Failed to update account.");
    }
  };

  // ---------------------------------------------------------------------------
  // Archive
  // ---------------------------------------------------------------------------

  const handleArchive = async (accountId: string, accountName: string) => {
    if (!confirm(`Archive "${accountName}"? It will no longer appear in reports.`)) return;
    const result = await archiveAccount(companyId, accountId);
    if (result.success) {
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      toast.success("Account archived.");
    } else {
      toast.error(result.error ?? "Failed to archive account.");
    }
  };

  // ---------------------------------------------------------------------------
  // Add new
  // ---------------------------------------------------------------------------

  const handleAdd = async () => {
    if (!newAccount.name.trim()) {
      toast.error("Account name is required.");
      return;
    }
    setSaving(true);
    const result = await createAccount(companyId, newAccount);
    setSaving(false);
    if (result.success && result.id) {
      const now = new Date().toISOString();
      const created: AccountRow = {
        id: result.id,
        company_id: companyId,
        code: newAccount.code || null,
        name: newAccount.name,
        account_type: newAccount.account_type,
        category: null,
        parent_account_id: null,
        display_order: 0,
        is_active: true,
        description: null,
        created_at: now,
        updated_at: now,
      };
      setAccounts((prev) => [...prev, created]);
      setNewAccount(BLANK_NEW_ACCOUNT);
      setIsAdding(false);
      toast.success("Account created.");
    } else {
      toast.error(result.error ?? "Failed to create account.");
    }
  };

  // ---------------------------------------------------------------------------
  // Initialize from template
  // ---------------------------------------------------------------------------

  const handleInitTemplate = async (template: TemplateType) => {
    if (accounts.length > 0) {
      toast.error("Archive all existing accounts before initializing from a template.");
      return;
    }
    setInitializingTemplate(true);
    const result = await initializeFromTemplate(companyId, template);
    setInitializingTemplate(false);
    if (result.success) {
      toast.success(`Created ${result.created} accounts from the ${template} template.`);
      // Next navigation / revalidation will refresh the list from the server
      window.location.reload();
    } else {
      toast.error(result.error ?? "Failed to initialize template.");
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-3">
      {/* Template initializer (only shown when no accounts) */}
      {accounts.length === 0 && (
        <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center space-y-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 mx-auto">
            <LayoutTemplate className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No accounts yet</p>
            <p className="text-xs text-muted-foreground">
              Initialize from a template or add accounts manually.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {(["saas", "ecommerce", "professional_services", "blank"] as TemplateType[]).map(
              (t) => (
                <Button
                  key={t}
                  variant="outline"
                  size="sm"
                  onClick={() => handleInitTemplate(t)}
                  disabled={initializingTemplate}
                >
                  {initializingTemplate && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {t === "saas" && "SaaS"}
                  {t === "ecommerce" && "E-commerce"}
                  {t === "professional_services" && "Professional Services"}
                  {t === "blank" && "Blank"}
                </Button>
              )
            )}
          </div>
        </div>
      )}

      {/* Template initializer shortcut when accounts exist */}
      {accounts.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            disabled={initializingTemplate}
            onClick={() => {
              toast.error("Archive all accounts first to use a template.");
            }}
          >
            <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" />
            Initialize from Template
          </Button>
        </div>
      )}

      {/* Main table */}
      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-24 text-xs uppercase tracking-wider">Code</TableHead>
              <TableHead className="text-xs uppercase tracking-wider">Name</TableHead>
              <TableHead className="w-28 text-xs uppercase tracking-wider">Type</TableHead>
              <TableHead className="w-20 text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="w-24 text-right text-xs uppercase tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((acc) => {
              const isEditing = editState?.accountId === acc.id;

              if (isEditing && editState) {
                return (
                  <TableRow key={acc.id} className="bg-blue-50/40">
                    <TableCell>
                      <Input
                        value={editState.code}
                        onChange={(e) =>
                          setEditState((prev) => prev && { ...prev, code: e.target.value })
                        }
                        className="h-7 text-sm w-20"
                        placeholder="Code"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editState.name}
                        onChange={(e) =>
                          setEditState((prev) => prev && { ...prev, name: e.target.value })
                        }
                        className="h-7 text-sm w-full max-w-[300px]"
                        placeholder="Account name"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={editState.account_type}
                        onValueChange={(v) =>
                          setEditState(
                            (prev) => prev && { ...prev, account_type: v as AccountType }
                          )
                        }
                      >
                        <SelectTrigger className="h-7 text-sm w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={saveEdit}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          <X className="w-3.5 h-3.5 text-slate-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow key={acc.id} className={cn(!acc.is_active && "opacity-50")}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {acc.code ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{acc.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", TYPE_BADGE_CLASS[acc.account_type])}
                    >
                      {acc.account_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={acc.is_active ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {acc.is_active ? "Active" : "Archived"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {acc.is_active && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => startEdit(acc)}
                            aria-label={`Edit ${acc.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => handleArchive(acc.id, acc.name)}
                            aria-label={`Archive ${acc.name}`}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Add new row */}
            {isAdding && (
              <TableRow className="bg-green-50/40">
                <TableCell>
                  <Input
                    value={newAccount.code}
                    onChange={(e) =>
                      setNewAccount((prev) => ({ ...prev, code: e.target.value }))
                    }
                    className="h-7 text-sm w-20"
                    placeholder="Code"
                    autoFocus
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={newAccount.name}
                    onChange={(e) =>
                      setNewAccount((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="h-7 text-sm w-full max-w-[300px]"
                    placeholder="Account name *"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={newAccount.account_type}
                    onValueChange={(v) =>
                      setNewAccount((prev) => ({ ...prev, account_type: v as AccountType }))
                    }
                  >
                    <SelectTrigger className="h-7 text-sm w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">New</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={handleAdd}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setIsAdding(false);
                        setNewAccount(BLANK_NEW_ACCOUNT);
                      }}
                      disabled={saving}
                    >
                      <X className="w-3.5 h-3.5 text-slate-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Empty state */}
            {accounts.length === 0 && !isAdding && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  No accounts yet. Add one manually or initialize from a template above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add button */}
      {!isAdding && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add account
        </Button>
      )}
    </div>
  );
}
