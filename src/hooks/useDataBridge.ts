import { useEffect } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useCustomersQuery } from './useCustomersQuery';
import { useWorkTypesQuery } from './useWorkTypesQuery';
import { useCommissionWorkersQuery } from './useCommissionWorkersQuery';
import { useCommissionPaymentsQuery } from './useCommissionPaymentsQuery';

/**
 * Syncs React Query cache into the Zustand dataStore.
 * Render once at the App level (inside QueryClientProvider).
 *
 * React Query handles: background refetch, stale-while-revalidate, refetchOnWindowFocus.
 * Zustand handles: local mutations, range-based job/payment/expense loading.
 * This bridge keeps them in sync for static-ish entities.
 */
export function useDataBridge() {
  const { backendConnected, setBulkCustomers, setBulkWorkTypes, setBulkCommissionWorkers, setBulkCommissionPayments } =
    useDataStore();

  const { data: customers } = useCustomersQuery();
  const { data: workTypes } = useWorkTypesQuery();
  const { data: commissionWorkers } = useCommissionWorkersQuery();
  const { data: commissionPayments } = useCommissionPaymentsQuery();

  useEffect(() => {
    if (customers && backendConnected) setBulkCustomers(customers);
  }, [customers, backendConnected, setBulkCustomers]);

  useEffect(() => {
    if (workTypes && backendConnected) setBulkWorkTypes(workTypes);
  }, [workTypes, backendConnected, setBulkWorkTypes]);

  useEffect(() => {
    if (commissionWorkers && backendConnected) setBulkCommissionWorkers(commissionWorkers);
  }, [commissionWorkers, backendConnected, setBulkCommissionWorkers]);

  useEffect(() => {
    if (commissionPayments && backendConnected) setBulkCommissionPayments(commissionPayments);
  }, [commissionPayments, backendConnected, setBulkCommissionPayments]);
}
