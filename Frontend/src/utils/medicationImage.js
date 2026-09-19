import axios from "axios";

const API_BASE = "http://127.0.0.1:5080/api/MedicationRequest";

export async function fetchMedicationImageUrl(requestId) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("尚未登入");

  const response = await axios.get(`${API_BASE}/${requestId}/image`, {
    responseType: "blob",
    headers: { Authorization: `Bearer ${token}` },
  });

  return URL.createObjectURL(response.data);
}

export async function openMedicationImage(requestId) {
  const url = await fetchMedicationImageUrl(requestId);
  const win = window.open(url, "_blank", "noopener,noreferrer");

  // 給新分頁足夠時間讀取 blob，再釋放 URL。
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error("瀏覽器阻擋了附件視窗");
  }
}
