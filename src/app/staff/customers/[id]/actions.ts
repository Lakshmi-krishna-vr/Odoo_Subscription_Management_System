"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth";
import { updateCustomerDetails } from "@/server/customers";

export interface CustomerActionState {
  error?: string;
  message?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  await requireRole(["admin", "staff"]);
  const customerId = String(formData.get("customerId") ?? "").trim();
  if (!UUID.test(customerId)) return { error: "Customer not found." };
  const paymentTermsText = String(formData.get("paymentTermsDays") ?? "").trim();

  try {
    await updateCustomerDetails(customerId, {
      contactName: String(formData.get("contactName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      address: String(formData.get("address") ?? ""),
      paymentTermsDays: paymentTermsText === "" ? Number.NaN : Number(paymentTermsText),
    });
    revalidatePath("/staff/customers");
    revalidatePath(`/staff/customers/${customerId}`);
    return { message: "Customer details saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The details were not saved." };
  }
}
