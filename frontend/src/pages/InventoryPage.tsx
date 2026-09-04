import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Filter,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Warehouse,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Dialog } from '../components/Dialog';
import {
  EmptyState,
  formatQuantity,
  SkeletonRows,
  StatusBadge,
} from '../components/Ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api, errorMessage } from '../services/api';
import type {
  Category,
  InventoryLine,
  Item,
  Location,
} from '../types';

type StockForm = {
  itemId: string;
  locationId: string;
  batch: string;
  quantity: string;
  reference: string;
  note: string;
};

const initialForm: StockForm = {
  itemId: '',
  locationId: '',
  batch: 'GENERAL',
  quantity: '',
  reference: '',
  note: '',
};

export function InventoryPage() {
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stockDialog, setStockDialog] = useState(false);
  const [form, setForm] = useState<StockForm>(initialForm);

  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const inventory = useQuery({
    queryKey: ['inventory', search, locationId, categoryId],
    queryFn: async () =>
      (
        await api.get<{ data: InventoryLine[] }>('/inventory', {
          params: {
            search: search || undefined,
            locationId: locationId || undefined,
            categoryId: categoryId || undefined,
          },
        })
      ).data.data,
  });

  const locations = useQuery({
    queryKey: ['locations'],
    queryFn: async () =>
      (await api.get<{ data: Location[] }>('/locations')).data.data,
  });

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () =>
      (await api.get<{ data: Category[] }>('/categories')).data.data,
  });

  const items = useQuery({
    queryKey: ['items'],
    queryFn: async () =>
      (await api.get<{ data: Item[] }>('/items')).data.data,
  });

  const canManage =
    user?.role === 'ADMIN' || user?.role === 'OPERATIONS_USER';

  const selectedItem = useMemo(
    () => items.data?.find((item) => item.id === form.itemId),
    [items.data, form.itemId]
  );

  const stats = useMemo(() => {
    const rows = inventory.data ?? [];

    const physical = rows.reduce(
      (sum, row) => sum + Number(row.physicalQuantity),
      0
    );

    const reserved = rows.reduce(
      (sum, row) => sum + Number(row.reservedQuantity),
      0
    );

    const available = rows.reduce(
      (sum, row) => sum + Number(row.availableQuantity),
      0
    );

    const lowStock = rows.filter(
      (row) => Number(row.availableQuantity) <= 10
    ).length;

    return {
      totalLines: rows.length,
      physical,
      reserved,
      available,
      lowStock,
    };
  }, [inventory.data]);

  const stockIn = useMutation({
    mutationFn: (payload: StockForm) =>
      api.post('/inventory', {
        ...payload,
        quantity: Number(payload.quantity),
        reference: payload.reference || undefined,
        note: payload.note || undefined,
      }),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['inventory'],
      });

      queryClient.invalidateQueries({
        queryKey: ['overview'],
      });

      toast.push('Inventory stock was recorded and audited.');

      setStockDialog(false);
      setForm(initialForm);
    },

    onError: (error) => {
      toast.push(errorMessage(error), 'error');
    },
  });

  const updateForm = <K extends keyof StockForm>(
    field: K,
    value: StockForm[K]
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const clearFilters = () => {
    setSearch('');
    setLocationId('');
    setCategoryId('');
  };

  const hasFilters = Boolean(
    search || locationId || categoryId
  );

  const submitStockIn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !form.itemId ||
      !form.locationId ||
      !form.quantity ||
      Number(form.quantity) <= 0
    ) {
      toast.push(
        'Select an item and location, then enter a positive quantity.',
        'error'
      );
      return;
    }

    stockIn.mutate(form);
  };

  return (
    <div className="page space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
            <Warehouse size={16} />
            Inventory Management
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-slate-950">
            Inventory
          </h2>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Monitor physical stock, reservations, and available quantities
            across every location and batch.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className="btn-secondary"
            onClick={() => inventory.refetch()}
            disabled={inventory.isFetching}
          >
            <RefreshCw
              size={16}
              className={inventory.isFetching ? 'animate-spin' : ''}
            />
            {inventory.isFetching ? 'Refreshing' : 'Refresh'}
          </button>

          {canManage && (
            <button
              className="btn-primary"
              onClick={() => setStockDialog(true)}
            >
              <Plus size={17} />
              Stock in
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card overflow-hidden">
          <div className="flex items-start justify-between p-5">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Inventory lines
              </p>

              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {stats.totalLines}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Active item / location / batch records
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
              <ClipboardList size={20} />
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-start justify-between p-5">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Physical quantity
              </p>

              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {formatQuantity(stats.physical)}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Total recorded stock
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <Package size={20} />
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-start justify-between p-5">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Available quantity
              </p>

              <p className="mt-2 text-2xl font-bold tracking-tight text-blue-700">
                {formatQuantity(stats.available)}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Physical minus reserved
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-start justify-between p-5">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Low stock
              </p>

              <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
                {stats.lowStock}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Lines with ≤ 10 available
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Inventory Card */}
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-slate-200 bg-slate-50/60 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            {/* Search */}
            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                className="input h-11 w-full pl-10 pr-4"
                placeholder="Search item, SKU, or batch..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                className="input h-11 w-full sm:w-52"
                value={locationId}
                onChange={(event) =>
                  setLocationId(event.target.value)
                }
              >
                <option value="">All locations</option>

                {locations.data?.map((location) => (
                  <option
                    value={location.id}
                    key={location.id}
                  >
                    {location.code} — {location.name}
                  </option>
                ))}
              </select>

              <select
                className="input h-11 w-full sm:w-48"
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(event.target.value)
                }
              >
                <option value="">All categories</option>

                {categories.data?.map((category) => (
                  <option
                    value={category.id}
                    key={category.id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>

              {hasFilters && (
                <button
                  type="button"
                  className="btn-secondary h-11 whitespace-nowrap"
                  onClick={clearFilters}
                >
                  <X size={15} />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Filter size={13} />

            {hasFilters ? (
              <span>
                Showing filtered inventory results
              </span>
            ) : (
              <span>
                Showing inventory across all locations and categories
              </span>
            )}

            {inventory.data && (
              <span className="font-medium text-slate-700">
                · {inventory.data.length} lines
              </span>
            )}
          </div>
        </div>

        {/* Error */}
        {inventory.isError ? (
          <div className="p-10">
            <EmptyState
              title="Couldn't load inventory"
              description="Check the API connection and try refreshing the table."
            />

            <div className="mt-5 flex justify-center">
              <button
                className="btn-secondary"
                onClick={() => inventory.refetch()}
              >
                <RefreshCw size={16} />
                Try again
              </button>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Batch</th>
                  <th>Location</th>
                  <th>Physical</th>
                  <th>Reserved</th>
                  <th className="bg-blue-50/70 text-blue-700">
                    Available
                  </th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {inventory.isLoading ? (
                  <SkeletonRows columns={7} />
                ) : inventory.data?.length ? (
                  inventory.data.map((line) => {
                    const available = Number(
                      line.availableQuantity
                    );

                    const isLow = available <= 10;
                    const isEmpty = available <= 0;

                    return (
                      <tr
                        key={line.id}
                        className="group"
                      >
                        {/* Item */}
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-blue-50 group-hover:text-blue-600">
                              <Package size={17} />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {line.item.name}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                {line.item.sku}
                                <span className="mx-1.5 text-slate-300">
                                  ·
                                </span>
                                {line.item.category.name}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Batch */}
                        <td>
                          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-600">
                            {line.batch}
                          </span>
                        </td>

                        {/* Location */}
                        <td>
                          <div className="flex items-center gap-2">
                            <MapPin
                              size={15}
                              className="text-slate-400"
                            />

                            <div>
                              <p className="font-semibold text-slate-800">
                                {line.location.code}
                              </p>

                              <p className="text-xs text-slate-500">
                                {line.location.name}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Physical */}
                        <td>
                          <span className="font-medium text-slate-700">
                            {formatQuantity(
                              line.physicalQuantity
                            )}
                          </span>
                        </td>

                        {/* Reserved */}
                        <td>
                          <span className="font-medium text-slate-600">
                            {formatQuantity(
                              line.reservedQuantity
                            )}
                          </span>
                        </td>

                        {/* Available */}
                        <td className="bg-blue-50/40">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-base font-bold ${
                                isEmpty
                                  ? 'text-red-600'
                                  : isLow
                                    ? 'text-amber-600'
                                    : 'text-blue-700'
                              }`}
                            >
                              {formatQuantity(
                                line.availableQuantity
                              )}
                            </span>

                            {isEmpty && (
                              <span className="text-xs font-medium text-red-500">
                                Empty
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <StatusBadge
                            value={
                              isEmpty
                                ? 'OUT OF STOCK'
                                : isLow
                                  ? 'LOW STOCK'
                                  : 'HEALTHY'
                            }
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="py-8">
                        <EmptyState
                          title="No inventory matches these filters"
                          description="Try changing the search or filters, or stock in a new item batch."
                        />

                        {hasFilters && (
                          <div className="mt-4 flex justify-center">
                            <button
                              className="btn-secondary"
                              onClick={clearFilters}
                            >
                              <X size={15} />
                              Clear filters
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer explanation */}
      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs leading-5 text-blue-800">
        <Filter
          size={14}
          className="mt-0.5 shrink-0"
        />

        <p>
          <span className="font-semibold">
            Available quantity
          </span>{' '}
          = physical quantity − reserved quantity. Backend
          transaction rules prevent available stock from becoming
          negative.
        </p>
      </div>

      {/* Stock In Dialog */}
      <Dialog
        open={stockDialog}
        title="Stock in inventory"
        onClose={() => {
          if (!stockIn.isPending) {
            setStockDialog(false);
          }
        }}
      >
        <form
          className="space-y-5"
          onSubmit={submitStockIn}
        >
          {/* Dialog intro */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex gap-3">
              <div className="rounded-lg bg-white p-2 text-blue-600 shadow-sm">
                <Package size={18} />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Add incoming stock
                </p>

                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Select the item and destination location, then
                  record the quantity received.
                </p>
              </div>
            </div>
          </div>

          {/* Item */}
          <div>
            <label className="label">
              Item
            </label>

            <select
              className="input h-11"
              value={form.itemId}
              onChange={(event) =>
                updateForm('itemId', event.target.value)
              }
              disabled={stockIn.isPending}
            >
              <option value="">
                Select an item
              </option>

              {items.data?.map((item) => (
                <option
                  value={item.id}
                  key={item.id}
                >
                  {item.sku} — {item.name}
                </option>
              ))}
            </select>

            {selectedItem && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <Package
                  size={14}
                  className="text-slate-400"
                />

                <p className="text-xs text-slate-600">
                  Category:{' '}
                  <span className="font-semibold text-slate-800">
                    {selectedItem.category.name}
                  </span>

                  <span className="mx-1.5 text-slate-300">
                    ·
                  </span>

                  Unit:{' '}
                  <span className="font-semibold text-slate-800">
                    {selectedItem.unit}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="label">
              Location
            </label>

            <select
              className="input h-11"
              value={form.locationId}
              onChange={(event) =>
                updateForm(
                  'locationId',
                  event.target.value
                )
              }
              disabled={stockIn.isPending}
            >
              <option value="">
                Select location
              </option>

              {locations.data?.map((location) => (
                <option
                  value={location.id}
                  key={location.id}
                >
                  {location.code} — {location.name}
                </option>
              ))}
            </select>
          </div>

          {/* Batch / Quantity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">
                Batch
              </label>

              <input
                className="input h-11"
                value={form.batch}
                onChange={(event) =>
                  updateForm(
                    'batch',
                    event.target.value
                  )
                }
                placeholder="GENERAL"
                maxLength={80}
                disabled={stockIn.isPending}
              />

              <p className="mt-1.5 text-xs text-slate-400">
                Use a supplier or production batch when applicable.
              </p>
            </div>

            <div>
              <label className="label">
                Quantity
              </label>

              <input
                className="input h-11"
                type="number"
                min="0.001"
                step="0.001"
                value={form.quantity}
                onChange={(event) =>
                  updateForm(
                    'quantity',
                    event.target.value
                  )
                }
                placeholder="0.000"
                disabled={stockIn.isPending}
              />
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="label">
              Reference{' '}
              <span className="font-normal text-slate-400">
                (optional)
              </span>
            </label>

            <input
              className="input h-11"
              placeholder="e.g. PO-2026-00124"
              value={form.reference}
              onChange={(event) =>
                updateForm(
                  'reference',
                  event.target.value
                )
              }
              maxLength={120}
              disabled={stockIn.isPending}
            />
          </div>

          {/* Note */}
          <div>
            <label className="label">
              Note{' '}
              <span className="font-normal text-slate-400">
                (optional)
              </span>
            </label>

            <textarea
              className="input min-h-20 resize-none py-2.5"
              placeholder="Add receiving or quality-control notes..."
              value={form.note}
              onChange={(event) =>
                updateForm(
                  'note',
                  event.target.value
                )
              }
              maxLength={500}
              disabled={stockIn.isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              className="btn-secondary"
              type="button"
              onClick={() => setStockDialog(false)}
              disabled={stockIn.isPending}
            >
              Cancel
            </button>

            <button
              className="btn-primary"
              type="submit"
              disabled={stockIn.isPending}
            >
              {stockIn.isPending ? (
                <>
                  <RefreshCw
                    size={16}
                    className="animate-spin"
                  />
                  Recording...
                </>
              ) : (
                <>
                  <Plus size={17} />
                  Record stock in
                </>
              )}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}