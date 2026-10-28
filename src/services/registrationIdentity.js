const CLUB_IDS_STORAGE_KEY = "ksport_club_ids_v1";

const normalizeClubName = (value) => String(value || "")
  .trim()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .toLowerCase()
  .replace(/\s+/g, " ");

export const createStableId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new Error("Trình duyệt không hỗ trợ tạo mã định danh K-SPORT");
};

// A name is never used as an athlete key. Club names are only a local lookup
// aid so the same browser does not create a new clubId for every submission.
export const getOrCreateClubId = (clubName) => {
  const key = normalizeClubName(clubName);
  if (!key) return null;
  let clubIds = {};
  try {
    clubIds = JSON.parse(localStorage.getItem(CLUB_IDS_STORAGE_KEY) || "{}") || {};
  } catch {
    clubIds = {};
  }
  if (!clubIds[key]) {
    clubIds[key] = createStableId();
    localStorage.setItem(CLUB_IDS_STORAGE_KEY, JSON.stringify(clubIds));
  }
  return clubIds[key];
};

export const validatePhotoFile = (file) => {
  if (!file) return null;
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
    return "Ảnh thẻ phải là JPG, PNG hoặc WebP.";
  }
  if (file.size < 1 || file.size > 5 * 1024 * 1024) {
    return "Ảnh thẻ không được vượt quá 5 MB.";
  }
  return null;
};

export const getKsportApiUrl = () => String(import.meta.env.VITE_KSPORT_API_URL || "").trim().replace(/\/$/, "");

export const uploadPendingRegistrationPhoto = async ({ apiUrl, athleteId, tournamentId, clubId, file }) => {
  const request = await fetch(`${apiUrl}/api/public/registration/athletes/${encodeURIComponent(athleteId)}/photo-upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tournamentId, clubId, contentType: file.type, sizeBytes: file.size }),
  });
  const signature = await request.json().catch(() => ({}));
  if (!request.ok || !signature?.uploadUrl || !signature?.objectKey) {
    throw new Error(signature?.message || "Không thể chuẩn bị upload ảnh thẻ");
  }

  const put = await fetch(signature.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error("Không thể tải ảnh thẻ lên kho lưu trữ");

  const complete = await fetch(`${apiUrl}/api/public/registration/athletes/${encodeURIComponent(athleteId)}/photo-complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tournamentId,
      clubId,
      objectKey: signature.objectKey,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  });
  const completed = await complete.json().catch(() => ({}));
  if (!complete.ok) throw new Error(completed?.message || "Không thể xác nhận ảnh thẻ");
  return completed;
};
