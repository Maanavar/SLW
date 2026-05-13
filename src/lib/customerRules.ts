import type { Customer } from '@/types';
import {
  CUSTOMER_SHORT_CODES,
  isMahalingamCustomerLabel,
  isRmpCustomer,
  isWagenAutosCustomerLabel,
  normalizeCustomerCode,
} from '@/constants/customers';

export function normalizeCustomers(customers: Customer[]): Customer[] {
  return customers.map((customer) => {
    const normalizedShortCode = normalizeCustomerCode(customer.shortCode);
    const isRmp = isRmpCustomer(customer.shortCode, customer.name);
    const isNm = isMahalingamCustomerLabel(customer.shortCode, customer.name);
    const hasBillNo = customer.hasBillNo === true || isRmp || isNm;

    if (isWagenAutosCustomerLabel(customer.name, customer.shortCode)) {
      return {
        ...customer,
        hasBillNo,
        requiresDc: false,
      };
    }

    if (isNm) {
      return {
        ...customer,
        hasBillNo,
        requiresDc: true,
      };
    }

    if (isRmp) {
      return {
        ...customer,
        hasBillNo: true,
      };
    }

    if (normalizedShortCode === CUSTOMER_SHORT_CODES.AKR) {
      return {
        ...customer,
        hasBillNo,
        hasCommission: true,
        requiresDc: false,
      };
    }

    const isCommissionDcCustomer = [1, 2, 17, 18].includes(customer.id);
    if (customer.id === 17 && !customer.shortCode) {
      return {
        ...customer,
        shortCode: 'AKR',
        hasBillNo,
        hasCommission: true,
        requiresDc: false,
      };
    }
    if (customer.id === 18 && !customer.shortCode) {
      return {
        ...customer,
        shortCode: 'AVP',
        hasBillNo,
        hasCommission: true,
        requiresDc: true,
      };
    }
    if (isCommissionDcCustomer) {
      return {
        ...customer,
        hasBillNo,
        hasCommission: true,
        requiresDc: true,
      };
    }

    return {
      ...customer,
      hasBillNo,
    };
  });
}
